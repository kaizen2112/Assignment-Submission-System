"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SessionProvider } from "@/components/layout/SessionContext";
import { TopNav } from "@/components/layout/TopNav";
import { PageTransition } from "@/components/ui/PageTransition";
import { api, ApiError } from "@/lib/api";
import { clearSession, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Role, UserProfile } from "@/types/api";

// The chrome every signed-in screen sits inside: a full-width product bar, a dark 240px sidebar, and a
// light content column. Dark navigation beside light content is the whole layout idea — it separates
// "where am I" from "what am I looking at" without a single divider line.
//
// It loads GET /auth/me on mount, which does double duty. The obvious half is the display name — the
// JWT carries sub/email/role but no name, so it cannot be read locally. The useful half is that this is
// the first real proof the session works: a token can look perfectly valid to the browser and still be
// signed with a rotated key or belong to a deleted user. If /me fails, the session is dead regardless
// of what localStorage says.
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  // Only used to key the page transition below — the sidebar reads the path itself.
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Only meaningful below lg, where the sidebar is off-canvas. At lg and up the `lg:translate-x-0`
  // below pins it open and this value is ignored.
  const [menuOpen, setMenuOpen] = useState(false);

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
    // The SessionProvider wraps the sidebar as well as the page, because the sidebar's footer shows the
    // signed-in user. Keeping /auth/me to a single request is the reason this context exists at all.
    <SessionProvider value={profile}>
      <div className="min-h-screen bg-surface">
        <TopNav
          role={role}
          profile={profile}
          onSignOut={handleSignOut}
          signingOut={signingOut}
          onMenuToggle={() => setMenuOpen((open) => !open)}
          menuOpen={menuOpen}
        />

        {/* top-14 rather than inset-y-0: the bar spans the full width, so the sidebar starts beneath it
            and the logo stays in the top-left corner where people look for it. */}
        <aside
          id="app-sidebar"
          // Any click inside closes the drawer. On mobile that means tapping a nav link both navigates
          // and dismisses — which is what you want, and avoids a setState-in-effect on pathname just to
          // achieve it. Harmless at lg and up, where the drawer state does not control visibility.
          onClick={() => setMenuOpen(false)}
          className={cn(
            "fixed bottom-0 left-0 top-14 z-40 w-60",
            "transition-transform duration-200 ease-out lg:translate-x-0",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar role={role} />
        </aside>

        {/* A real <button>, not a div: it is the drawer's dismiss control, so it has to be focusable and
            respond to Enter as well as to a tap. */}
        {menuOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-x-0 bottom-0 top-14 z-30 bg-slate-900/40 lg:hidden"
          />
        )}

        <main className="lg:pl-60">
          {/* max-w-300 = 1200px. Generous padding is the point of the redesign, so it steps up rather
              than staying at a single cramped value on every screen. */}
          <div className="mx-auto max-w-300 px-4 py-8 sm:px-6 lg:px-8">
            {/* Keyed on the pathname so a navigation is a new element as far as React is concerned,
                which is what re-runs the enter animation. Without the key the div persists across
                routes and the transition would play once, on the first page of the session, only.

                Wrapped here rather than inside each page: one place to change the timing, and no page
                can be added later that forgets to animate. The sidebar and top bar sit outside it on
                purpose — chrome that faded on every click would be exhausting. */}
            <PageTransition key={pathname}>{children}</PageTransition>
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
