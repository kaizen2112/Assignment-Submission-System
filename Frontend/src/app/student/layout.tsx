import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/layout/RoleGuard";

// See the note in app/admin/layout.tsx — server component by design, role hard-coded per area.
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="Student">
      <AppShell role="Student">{children}</AppShell>
    </RoleGuard>
  );
}
