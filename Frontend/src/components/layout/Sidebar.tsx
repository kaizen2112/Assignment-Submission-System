"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
}

// Only links to pages that actually exist. A sidebar full of 404s is worse than a short one, and the
// role areas are built across Steps 2–4 — Step 3 adds the assignment and submission entries here as it
// creates them. The per-role split is the point: a Student never renders a link to a teacher screen.
//
// This is presentation, not security. The backend rejects a Student calling a teacher endpoint whether
// or not a link to it was ever drawn.
const NAV: Record<Role, NavItem[]> = {
  Admin: [{ href: "/admin/dashboard", label: "Dashboard" }],
  Teacher: [
    { href: "/teacher/dashboard", label: "Dashboard" },
    { href: "/teacher/assignments", label: "Assignments" },
  ],
  Student: [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/assignments", label: "Assignments" },
    { href: "/student/submissions", label: "My submissions" },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV[role];

  return (
    <nav aria-label="Main navigation" className="flex gap-1 md:flex-col">
      {items.map((item) => {
        // startsWith, not equality, so /teacher/assignments/123 keeps "Assignments" highlighted.
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            // aria-current is what tells a screen reader which page it is on; the colour alone does not.
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
