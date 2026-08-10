// Both api.ts and auth.ts need the base URL, and auth.ts must not import api.ts (see the note in
// auth.ts about the import cycle). One tiny module they can both depend on avoids it.
//
// NEXT_PUBLIC_ prefix is required for the value to reach the browser bundle.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5274/api/v1";

// Storage keys, named once so a typo cannot silently split reads from writes.
export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

// Mirrored into a cookie purely so middleware.ts can route by role. middleware runs on the server,
// where localStorage does not exist. UX only — see the warning in middleware.ts.
export const ROLE_COOKIE = "role";
