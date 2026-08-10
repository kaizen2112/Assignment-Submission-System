import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGuard } from "@/components/layout/RoleGuard";

// See the note in app/admin/layout.tsx — server component by design, role hard-coded per area.
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="Teacher">
      <AppShell role="Teacher">{children}</AppShell>
    </RoleGuard>
  );
}
