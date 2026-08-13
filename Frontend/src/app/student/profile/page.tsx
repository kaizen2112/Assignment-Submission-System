import { ProfileView } from "@/components/profile/ProfileView";

// See the note in the teacher's copy: the role segment is what supplies AppShell and RoleGuard.
export default function StudentProfilePage() {
  return <ProfileView role="Student" />;
}
