"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { dashboardPathFor, getRole, isAuthenticated } from "@/lib/auth";
import type { Role } from "@/types/api";

// ⚠️ UX ONLY, exactly like proxy.ts. This hides screens; it does not protect data. Every request the
// wrapped page makes is authorised again by [Authorize] on the backend, which is the only real
// enforcement of rules 3, 4, 6 and 7.
//
// This exists *in addition* to proxy.ts because the two read different things. proxy.ts reads the role
// cookie on the server; this reads the JWT in localStorage. They disagree in one case that matters: if
// the cookie survives but the tokens are gone — a user clearing localStorage, or a half-finished
// sign-out — proxy waves them through to a dashboard where every request then fails. Checking the
// token here turns that into a clean redirect to /login.

// Returns where the visitor should be sent instead, or null if they belong here. Pure and synchronous,
// so the decision is made during render rather than in an effect.
function redirectTarget(expected: Role): string | null {
  if (!isAuthenticated()) return "/login";

  const actual = getRole();

  // A token we cannot read a role out of is unusable. Treat it as no session rather than guessing.
  if (actual === null) return "/login";

  // Their own dashboard, not /login — bouncing a signed-in user to a login form reads as if the
  // session broke.
  return actual === expected ? null : dashboardPathFor(actual);
}

export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();

  // Before hydration there is no localStorage to read, so no decision is possible yet. A string-or-null
  // keeps this stable across renders — returning an object would give the effect below a new dependency
  // identity every time and re-fire the navigation.
  const target = hydrated ? redirectTarget(role) : null;
  const allowed = hydrated && target === null;

  useEffect(() => {
    if (target !== null) router.replace(target);
  }, [target, router]);

  // Never render children until allowed. Rendering them optimistically would flash another role's
  // screen for a frame and fire that page's data requests before the redirect commits.
  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
