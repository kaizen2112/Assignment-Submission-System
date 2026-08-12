"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const profile = useSession();
  const items = NAV[role];

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 p-3">
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
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {/* The accent bar, drawn only for the active item. Absolutely positioned so it does not
                  shift the label by 3px when the page changes. */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1.5 left-0 w-0.75 rounded-r-full bg-indigo-400"
                />
              )}

              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
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
