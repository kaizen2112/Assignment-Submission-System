// Mirrors the backend DTOs exactly. If a response shape changes in Application/DTOs, change it here
// too — this file is the only place the frontend states what the API returns.
//
// Enums are string unions rather than TypeScript enums because the API serialises them as strings
// (`.HasConversion<string>()` on the entities, `.ToString()` in the response mappers). A union also
// narrows in a switch without an import at the call site.

export type Role = "Admin" | "Teacher" | "Student";
export type AssignmentStatus = "Draft" | "Published";
export type SubmissionStatus = "NotSubmitted" | "Submitted" | "Late" | "Graded";

// --- Auth (Application/DTOs/Auth/AuthDtos.cs) ----------------------------------------------------

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// --- Assignments (Application/DTOs/Assignment/AssignmentDtos.cs) ---------------------------------

// How much of a class has handed one assignment in (Application/DTOs/Assignment/CompletionStats.cs).
//
// `percentage` arrives already rounded to one decimal and already decided for the zero-enrolment case: the
// server sends 0, and the UI renders an em dash instead, because "0% of nobody" is a different statement
// from "0% of eighteen".
export interface CompletionStats {
  totalEnrolled: number;
  totalSubmitted: number;
  percentage: number;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  deadline: string;
  maxMarks: number;
  status: AssignmentStatus;
  allowLateSubmission: boolean;
  // Computed server-side from the current clock, never stored.
  isOverdue: boolean;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  createdByTeacherId: string;
  // Who set the work. Sent as a name and not only an id, because resolving one to the other client-side
  // would mean listing users — which only an admin may do.
  createdByTeacherName: string;
  createdAt: string;
  updatedAt: string;
  // **Null for a student**, and null because the server withheld it rather than because the UI hides it:
  // how many classmates have submitted is information about other people. Teacher and admin only.
  completion: CompletionStats | null;
}

// The list endpoint omits `description` — up to 5000 characters per row, which no list screen shows.
// It does carry the teacher, though: the student's cards name whoever set each assignment, and filling
// that in from the detail endpoint would be one request per card.
export type AssignmentListItem = Omit<Assignment, "description" | "updatedAt">;

export interface CreateAssignmentRequest {
  title: string;
  description: string;
  deadline: string;
  maxMarks: number;
  classId: string;
  subjectId: string;
  allowLateSubmission: boolean;
}

// No classId/subjectId: an assignment cannot move between classes once created.
export type UpdateAssignmentRequest = Omit<
  CreateAssignmentRequest,
  "classId" | "subjectId"
>;

// GET /assignments/teaching-scope — one row per class+subject pair the calling teacher holds. Added in
// Phase 5 because nothing else in the API let a teacher discover their own classId/subjectId, which the
// create form needs. Flat, not a class with nested subjects: rule 4 grants a *pair*, so a teacher may
// hold Mathematics in 10A without holding Physics in 10A.
export interface TeachingScope {
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
}

// --- Submissions (Application/DTOs/Submission/SubmissionDtos.cs) ---------------------------------

export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  maxMarks: number;
  studentId: string;
  studentName: string;
  answerText: string;
  status: SubmissionStatus;
  marks: number | null;
  feedback: string | null;
  // Kept separate from `status` so grading a late submission does not erase that it arrived late.
  isLate: boolean;
  submittedAt: string;
  updatedAt: string | null;
  gradedAt: string | null;
}

export interface SubmitAnswerRequest {
  answerText: string;
}

export interface GradeSubmissionRequest {
  marks: number;
  feedback: string | null;
}

export interface ChangeSubmissionStatusRequest {
  status: SubmissionStatus;
}

// --- Admin (Application/DTOs/Admin/AdminDtos.cs) -------------------------------------------------

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}

// Omit `newPassword` to leave the existing password untouched.
export interface UpdateUserRequest {
  fullName: string;
  email: string;
  role: Role;
  newPassword?: string;
}

export interface Subject {
  id: string;
  name: string;
  classId: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  subjects: Subject[];
}

export interface CreateClassRequest {
  name: string;
  code: string;
}

// One class the signed-in student is enrolled in (Application/DTOs/Class/ClassDtos.cs). Deliberately not
// `SchoolClass`: that shape is the admin's, and carries the class's whole subject list.
export interface EnrolledClass {
  classId: string;
  className: string;
  classCode: string;
  enrolledAt: string;
}

// One person on a class roster, as a classmate sees it. Name and email and nothing else — no marks, no
// submission counts. See assumption A17 on the email being visible to classmates.
export interface Classmate {
  id: string;
  fullName: string;
  email: string;
  // True for the signed-in student's own row. Decided server-side, so the client does not need its own id.
  isYou: boolean;
}

export interface CreateSubjectRequest {
  name: string;
}

export interface CreateTeacherAssignmentRequest {
  teacherId: string;
  subjectId: string;
  classId: string;
}

export interface TeacherAssignmentResponse {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  assignedAt: string;
}

export interface CreateEnrollmentRequest {
  studentId: string;
  classId: string;
}

export interface EnrollmentResponse {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  enrolledAt: string;
}

// --- Pagination (Application/Common/PagedResult.cs + PaginationQuery.cs) -------------------------

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 20;

// The server rejects anything larger with a 400 rather than silently clamping it.
export const MAX_PAGE_SIZE = 100;

export interface PagedQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface AssignmentQuery extends PagedQuery {
  classId?: string;
  subjectId?: string;
  status?: AssignmentStatus;
}

export interface UserQuery extends PagedQuery {
  role?: Role;
  search?: string;
}

// --- Comments -----------------------------------------------------------------------------------

// The thread is two levels deep, so `replies` is always present and always empty on a reply itself.
// Mirrors CommentResponse in the API.
//
// Two levels is about the *rows*, not the conversation: replying to a reply is allowed and comes back as
// another entry in the same `replies` array, with `replyToAuthorName` set. The @mention is what carries
// "this answers you" once there is no third indent to say it.
//
// Note what the server withholds rather than what it sends: on a deleted comment both `content` and
// `authorName` arrive as empty strings. The row is here only so its replies stay reachable, and the
// placeholder is rendered from `isDeleted` — there is nothing to un-hide, because nothing was sent.
export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  upvoteCount: number;
  // Per-caller, not per-row: whether *you* have upvoted this one.
  hasUpvoted: boolean;
  isDeleted: boolean;
  // Both null unless this reply answered another reply — and both null again if that comment has since
  // been deleted, since a tombstone does not record who was removed from the thread.
  replyToCommentId: string | null;
  replyToAuthorName: string | null;
  replies: Comment[];
}

export interface CreateCommentRequest {
  content: string;
}

// The toggle endpoint returns only what can have changed, so an optimistic update has something exact
// to reconcile against.
export interface UpvoteResult {
  upvoteCount: number;
  hasUpvoted: boolean;
}

export const COMMENT_MAX_LENGTH = 1000;

// --- Errors (RFC 7807, produced by ResultExtensions + ValidationProblems) ------------------------

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  // Present only on validation failures, keyed by camelCase field name.
  errors?: Record<string, string[]>;
}
