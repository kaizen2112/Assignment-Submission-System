import { API_BASE_URL } from "@/lib/config";
import { clearSession, getAccessToken, refreshTokens } from "@/lib/auth";
import type { PagedQuery, ProblemDetails } from "@/types/api";

// The single place every HTTP call goes through. Attaches the Bearer token, refreshes it once on a
// 401 and retries, and turns every failure into an ApiError carrying the RFC 7807 body.

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | undefined;
  // Field-keyed validation messages, present only on a 400 from the validation filter.
  readonly errors: Record<string, string[]> | undefined;

  constructor(status: number, problem: ProblemDetails | null) {
    // The message shown if nobody inspects the parts: prefer the server's sentence, since those are
    // written for humans ("Marks cannot exceed the maximum of 50.").
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}.`);

    this.name = "ApiError";
    this.status = status;
    this.detail = problem?.detail;
    this.errors = problem?.errors;
  }

  // True when the session is gone for good rather than merely stale — api.ts has already tried to
  // refresh by the time a 401 surfaces here.
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  // The first message for a given field, for wiring straight into a form.
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function readProblem(response: Response): Promise<ProblemDetails | null> {
  // An error response is not guaranteed to be JSON — a 404 from an unmatched route has an empty
  // body, and a proxy failure could return HTML. Never let parsing the error throw over the error.
  try {
    const text = await response.text();
    return text ? (JSON.parse(text) as ProblemDetails) : null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  // Access tokens live 15 minutes, so a 401 mid-session is expected rather than exceptional. Refresh
  // once and replay. `isRetry` is what stops this recursing: a second 401 means the refresh token is
  // dead too, and the caller gets the 401 to act on.
  if (response.status === 401 && !isRetry) {
    const refreshed = await refreshTokens();

    if (!refreshed) {
      clearSession();
      // Thrown, never returned. The doc's sketch returned undefined here, which would have handed
      // callers a value typed T that was not one.
      throw new ApiError(401, { detail: "Your session has expired. Please sign in again." });
    }

    return request<T>(path, options, true);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response));
  }

  // 204 from DELETE, and 200 with an empty body, are both success with nothing to parse. Calling
  // .json() on either throws — so callers use ApiResponse<void> for these.
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Builds a query string, dropping undefined/null/empty values so `?page=1&classId=` never reaches
// the server — an empty classId would fail Guid model binding with a 400.
export function toQueryString(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>, signal?: AbortSignal) =>
    request<T>(`${path}${toQueryString(query)}`, { signal }),

  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),

  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),

  // Typed as void by default: the API answers DELETE with 204 and no body.
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Convenience re-export so pages can spread a paging query without importing the type separately.
export type { PagedQuery };
