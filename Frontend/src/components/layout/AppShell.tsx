"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "@/components/layout/Sidebar";
import { SessionProvider } from "@/components/layout/SessionContext";
import { api, ApiError } from "@/lib/api";
import { clearSession, logout } from "@/lib/auth";
import type { Role, UserProfile } from "@/types/api";

// The chrome every signed-in screen sits inside: sidebar, header with the current user, sign-out.
//
// It loads GET /auth/me on mount, which does double duty. The obvious half is the display name — the
// JWT carries sub/email/role but no name, so it cannot be read locally. The useful half is that this is
// the first real proof the session works: a token can look perfectly valid to the browser and still be
// signed with a rotated key or belong to a deleted user. If /me fails, the session is dead regardless
// of what localStorage says.
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Aborted on unmount so a slow /me cannot resolve into an unmounted component, and so navigating
    // away mid-flight does not leave the request running.
    const controller = new AbortController();

    api
      .get<UserProfile>("/auth/me", undefined, controller.signal)
      .then(setProfile)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        // api.ts has already tried a refresh by the time a 401 reaches here, so this is terminal.
        if (error instanceof ApiError && error.isUnauthorized) {
          clearSession();
          router.replace("/login");
          return;
        }

        // Anything else — the API being down, a network drop — is not a reason to sign the user out.
        // The header falls back to the role alone and the page's own error handling takes over.
      });

    return () => controller.abort();
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    // logout() revokes the refresh token server-side, then clears local state. It never throws.
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">Assignment System</span>
            <Badge tone="info">{role}</Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Reserves nothing while loading: a skeleton here would shift the header once /me lands. */}
            {profile && (
              <span className="hidden text-sm text-slate-600 sm:inline">{profile.fullName}</span>
            )}
            <Button variant="secondary" size="sm" onClick={handleSignOut} loading={signingOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        {/* Horizontal strip on small screens, a column on md+ — no drawer, no toggle state to manage. */}
        <aside className="md:w-48 md:shrink-0">
          <Sidebar role={role} />
        </aside>

        <main className="min-w-0 flex-1">
          <SessionProvider value={profile}>{children}</SessionProvider>
        </main>
      </div>
    </div>
  );
}
