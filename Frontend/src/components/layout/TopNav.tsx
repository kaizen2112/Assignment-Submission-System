"use client";

import Link from "next/link";
import { GraduationCap, Menu } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn, ROLE_TONES } from "@/lib/utils";
import type { Role, UserProfile } from "@/types/api";

// The product bar: 56px, white, one hairline underneath. It sits above the sidebar rather than beside it
// so the brand and the signed-in identity stay in the same place no matter which role is looking.
//
// The role pill makes a screenshot from an evaluation session self-describing — you can tell which
// account it was taken under without reading the URL, which matters because the walkthrough keeps two
// sessions open side by side for most of Parts 3 to 5. Tones come from utils so this pill and the Role
// column of the admin users table cannot drift apart.

export function TopNav({
  role,
  profile,
  onSignOut,
  signingOut,
  onMenuToggle,
  menuOpen,
}: {
  role: Role;
  // null until GET /auth/me lands. The bar renders its full height either way — reserving the space is
  // what stops the whole page nudging downward when the name arrives.
  profile: UserProfile | null;
  onSignOut: () => void;
  signingOut: boolean;
  // Opens the off-canvas sidebar. Only rendered below lg, where the sidebar is not permanently visible.
  onMenuToggle: () => void;
  menuOpen: boolean;
}) {
  return (
    // z-50 so it stays above the sidebar drawer and its backdrop — the sign-out button and the menu
    // toggle must remain reachable while the drawer is open.
    <header className="sticky top-0 z-50 h-14 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"
          >
            <GraduationCap className="size-4" />
          </span>

          {/* Hidden on the narrowest screens, where the logo mark alone identifies the app and the space
              is better spent on the user's name. */}
          <span className="hidden truncate text-sm font-semibold text-gray-900 dark:text-gray-100 sm:inline">
            Assignment System
          </span>

          <Badge tone={ROLE_TONES[role]}>{role}</Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Left of the name, per the design: the theme is a property of the app, not of the account,
              so it sits on the app side of that boundary rather than reading as a profile control. */}
          <ThemeToggle />

          {/* The name and avatar are the link to the profile, which is where every application on earth puts
              it. A plain <Link> rather than a dropdown menu: there is exactly one destination behind it, and a
              menu holding a single item is a click nobody needs. */}
          {profile && (
            <Link
              href={`/${role.toLowerCase()}/profile`}
              title="Your profile"
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-1.5 py-1",
                "transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <span className="hidden max-w-40 truncate text-sm font-medium text-gray-700 dark:text-gray-200 sm:inline">
                {profile.fullName}
              </span>
              <Avatar fullName={profile.fullName} />
            </Link>
          )}

          {/* A ghost text link, not a button. Signing out is the least likely thing anyone came here to
              do, so it should not look like the most prominent control on the page. */}
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(
              "rounded-md px-2 py-1 text-sm font-medium text-gray-500 dark:text-gray-400",
              "transition-colors duration-150 hover:text-gray-900 dark:hover:text-gray-100",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
