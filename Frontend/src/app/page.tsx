"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardPathFor, getRole, isAuthenticated } from "@/lib/auth";

// The entry point at "/". Sends the visitor to their own dashboard, or to /login.
//
// This duplicates what middleware.ts already decides, and that is deliberate: middleware reads the
// role *cookie*, this reads the *token*. If the cookie is present but the tokens were cleared (a user
// wiping localStorage, or a half-finished sign-out), middleware would wave them through to a
// dashboard that then fails every request. Checking the token here catches that case.
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // localStorage is only readable after mount, so the redirect cannot happen during render.
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    const role = getRole();

    // A token we cannot read a role out of is unusable — treat it as no session at all rather than
    // guessing a destination.
    router.replace(role ? dashboardPathFor(role) : "/login");
  }, [router]);

  // Shown for the one frame before the redirect commits. Deliberately not a spinner-with-text that
  // would flash on a fast machine.
  return (
    <main className="grid min-h-screen place-items-center">
      <p className="text-sm text-slate-500" role="status">
        Loading…
      </p>
    </main>
  );
}
