import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/layout/RoleGuard";

// Not a client component. RoleGuard and AppShell are the parts that need the browser; this layout only
// composes them, and a server component can render client components freely. Marking the layout itself
// "use client" would opt every page beneath it out of server rendering for no gain.
//
// The role is hard-coded per area rather than read from the token: this file *is* the assertion that
// everything under /admin is admin-only. Reading the role here would make the guard tautological.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="Admin">
      <AppShell role="Admin">{children}</AppShell>
    </RoleGuard>
  );
}
