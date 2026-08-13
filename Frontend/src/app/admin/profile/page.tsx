import { ProfileView } from "@/components/profile/ProfileView";

// See the note in the teacher's copy: the role segment is what supplies AppShell and RoleGuard.
//
// An admin gets the same page minus the class card — they hold no teaching grant and no enrolment, and reach
// every class through /admin/classes instead.
export default function AdminProfilePage() {
  return <ProfileView role="Admin" />;
}
