import {
  ACCESS_TOKEN_KEY,
  API_BASE_URL,
  REFRESH_TOKEN_KEY,
  ROLE_COOKIE,
} from "@/lib/config";
import type { AuthResponse, Role, UserProfile } from "@/types/api";

// Token storage, role detection and session lifecycle.
//
// This module deliberately uses plain fetch rather than importing api.ts, even though api.ts is the
// house style for HTTP. api.ts imports getAccessToken and refreshTokens from here, so importing it
// back would create a cycle. The three calls below are also the only ones that do not want api.ts's
// machinery: login is anonymous, refresh IS the 401 recovery, and logout must not attempt one.

// --- Storage ------------------------------------------------------------------------------------

// Every accessor guards on `window`. These modules are imported by components that Next may render
// on the server, where localStorage does not exist — an unguarded read crashes the render.
const canUseStorage = (): boolean => typeof window !== "undefined";

export function getAccessToken(): string | null {
  return canUseStorage() ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function getRefreshToken(): string | null {
  return canUseStorage() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

function storeSession(auth: AuthResponse): void {
  if (!canUseStorage()) return;

  window.localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);

  // Session-scoped cookie (no Expires), SameSite=Lax so it survives ordinary navigation but is not
  // sent on cross-site requests. Not httpOnly, because nothing here is a secret: the role is public
  // information about the logged-in user, and the tokens stay in localStorage.
  document.cookie = `${ROLE_COOKIE}=${auth.user.role}; Path=/; SameSite=Lax`;
}

export function clearSession(): void {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

// --- JWT decoding -------------------------------------------------------------------------------

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
}

// Decodes without verifying. Verification is the server's job and cannot be done here — the signing
// key is not, and must never be, in the browser. This is only used to read the role for rendering.
// Every route the token unlocks is enforced again by [Authorize] on the backend.
function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    // base64url -> base64, then pad to a multiple of 4 so atob accepts it.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    // A malformed token is treated as no token rather than throwing into a render.
    return null;
  }
}

const isRole = (value: string | undefined): value is Role =>
  value === "Admin" || value === "Teacher" || value === "Student";

// Read back from the stored token on every page load, so a refresh restores the session without
// keeping role state in a store that would need rehydrating.
export function getRole(): Role | null {
  const token = getAccessToken();
  if (!token) return null;

  const role = decodeJwt(token)?.role;
  return isRole(role) ? role : null;
}

export function getUserId(): string | null {
  const token = getAccessToken();
  return token ? decodeJwt(token)?.sub ?? null : null;
}

// True when a token exists and has not expired. `exp` is in seconds, Date.now() in milliseconds.
// An expired access token still counts as a session, because api.ts can silently refresh it — this
// only reports whether we have *nothing* to work with.
export function isAuthenticated(): boolean {
  return getAccessToken() !== null && getRefreshToken() !== null;
}

export function isAccessTokenExpired(): boolean {
  const token = getAccessToken();
  if (!token) return true;

  const exp = decodeJwt(token)?.exp;
  return exp === undefined || exp * 1000 <= Date.now();
}

// Where each role lands after login. Real URL segments, not route groups, so middleware.ts can match
// on the path prefix — see the note in middleware.ts.
export function dashboardPathFor(role: Role): string {
  switch (role) {
    case "Admin":
      return "/admin/dashboard";
    case "Teacher":
      return "/teacher/dashboard";
    case "Student":
      return "/student/dashboard";
  }
}

// --- Session lifecycle --------------------------------------------------------------------------

export interface LoginResult {
  ok: boolean;
  user?: UserProfile;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    // The API returns one message for both an unknown email and a wrong password, deliberately —
    // distinguishing them would be a free account-enumeration oracle. Surface it as-is.
    const problem = await response.json().catch(() => null);
    return {
      ok: false,
      error: problem?.detail ?? "Unable to sign in. Please check your details and try again.",
    };
  }

  const auth = (await response.json()) as AuthResponse;
  storeSession(auth);

  return { ok: true, user: auth.user };
}

// Single in-flight refresh. Without this, three components hitting a 401 at once would each rotate
// the token; the backend revokes the presented token on use, so two of the three would then be
// holding an already-revoked token and the session would collapse.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    storeSession((await response.json()) as AuthResponse);
    return true;
  } catch {
    // Network failure, not a rejected token. Reported as "could not refresh" so the caller shows an
    // error rather than silently signing the user out over a dropped connection.
    return false;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();

  // Best effort: tell the server to revoke the refresh token so it cannot be replayed. A failure
  // here must not block the local sign-out, which is what the user actually asked for.
  if (refreshToken && accessToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignored on purpose — see above.
    }
  }

  clearSession();
}
