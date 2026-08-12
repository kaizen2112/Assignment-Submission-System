"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SidebarClasses } from "@/components/layout/SidebarClasses";
import { useSession } from "@/components/layout/SessionContext";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Only links to pages that actually exist. A sidebar full of 404s is worse than a short one. The per-role
// split is the point: a Student never renders a link to a teacher screen.
//
// This is presentation, not security. The backend rejects a Student calling a teacher endpoint whether or
// not a link to it was ever drawn.
//
// The admin entries cover every admin endpoint the API has, so administration never needs Swagger.
// Users and Classes are where the work happens; the last two are read-only oversight.
const NAV: Record<Role, NavItem[]> = {
  Admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/classes", label: "Classes", icon: Layers },
    { href: "/admin/assignments", label: "All assignments", icon: ClipboardList },
    { href: "/admin/submissions", label: "All submissions", icon: FileCheck2 },
  ],
  Teacher: [
    { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/teacher/assignments", label: "Assignments", icon: ClipboardList },
  ],
  Student: [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/assignments", label: "Assignments", icon: BookOpen },
    { href: "/student/submissions", label: "My submissions", icon: FileCheck2 },
  ],
};

// Dark navigation against light content. The contrast does the work a border would otherwise have to do:
// you always know whether you are looking at the app's chrome or at your data.
//
// In dark mode that contrast has to be re-earned rather than inherited. The page ground drops to
// gray-900 (#111827), which is within a few points of slate-900 (#0f172a) — near enough that the
// sidebar would dissolve into the content and the entire layout idea with it. So the sidebar goes
// *darker* instead, to gray-950, staying the darkest surface on screen in both themes. Making it
// lighter would have been the alternative, and it is the wrong one: navigation that outshines the data
// inverts the hierarchy the design is built on.
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const profile = useSession();
  const items = NAV[role];

  // The sliding pill is the one animation here that moves a box rather than fading it, so it is also the
  // one most worth switching off for someone who asked for no motion.
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full flex-col bg-slate-900 dark:bg-gray-950">
      <nav
        aria-label="Main navigation"
        className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
      >
        {items.map((item) => {
          // startsWith, not equality, so /teacher/assignments/123 keeps "Assignments" highlighted.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              // aria-current is what tells a screen reader which page it is on; the colour alone does not.
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                "transition-colors duration-150",
                // The active item no longer paints its own background — the shared pill below does, so
                // that the fill can travel between items instead of blinking off one and on at another.
                isActive ? "text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {/* One pill, shared across every nav item by its layoutId. Only ever rendered inside the
                  active link, so when the route changes Framer sees the same identity in a new place and
                  interpolates between the two — the highlight slides rather than jumping. The accent bar
                  rides inside it, which is why it does not need a layoutId of its own.

                  A spring rather than a duration: the distance varies with how far apart the two items
                  are, and a fixed duration makes a short hop feel sluggish and a long one feel rushed. */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-white/10"
                  transition={
                    reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }
                  }
                >
                  {/* The accent bar. Inset vertically so it reads as a marker against the pill's edge
                      rather than as a border on it. */}
                  <span className="absolute inset-y-1.5 left-0 w-0.75 rounded-r-full bg-indigo-400" />
                </motion.span>
              )}

              {/* `relative` on both: the pill is absolutely positioned and would otherwise paint over
                  static content, hiding the very label it is meant to highlight. */}
              <Icon aria-hidden="true" className="relative size-4 shrink-0" />
              <span className="relative truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* Below the fixed nav, and scrollable with it: a teacher with eight classes must not push their own
            identity card off the bottom of the screen, which is why the <nav> is the flex-1 scroller and the
            footer below is not.

            Wrapped in Suspense because the teacher tree reads useSearchParams to highlight the active
            subject, and this sidebar renders inside the layout of every authenticated page. Without a
            boundary that turns a prerenderable page into a build error — a failure that never shows up in
            `next dev`, only in `next build`, which is what the Docker web image runs. */}
        <Suspense fallback={null}>
          <SidebarClasses role={role} />
        </Suspense>
      </nav>

      {/* Identity at the foot of the navigation, the convention in every tool people already use. The top
          bar carries it too, but that one scrolls out of mind; this one is where you look to check which
          account you are in. */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
          {profile ? (
            <Avatar fullName={profile.fullName} size="sm" />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50"
            >
              <GraduationCap className="size-3.5" />
            </span>
          )}

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {profile?.fullName ?? "Signing in…"}
            </p>
            <p className="truncate text-[11px] text-white/50">{role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
