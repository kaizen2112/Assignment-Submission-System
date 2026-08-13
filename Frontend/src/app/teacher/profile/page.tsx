import { ProfileView } from "@/components/profile/ProfileView";

// One shared view, three thin routes. The profile has to live *inside* a role segment rather than at a bare
// /profile, because the AppShell and RoleGuard that wrap every signed-in screen are mounted by the role
// layouts — a top-level route would render without the chrome and without the guard.
export default function TeacherProfilePage() {
  return <ProfileView role="Teacher" />;
}
