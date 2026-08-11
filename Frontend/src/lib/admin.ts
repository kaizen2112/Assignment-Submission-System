import { api } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type {
  AdminUser,
  AssignmentListItem,
  AssignmentQuery,
  CreateClassRequest,
  CreateEnrollmentRequest,
  CreateSubjectRequest,
  CreateTeacherAssignmentRequest,
  CreateUserRequest,
  EnrollmentResponse,
  PagedQuery,
  PagedResult,
  SchoolClass,
  Submission,
  TeacherAssignmentResponse,
  UpdateUserRequest,
  UserQuery,
} from "@/types/api";

// The admin half of the API, in one place — the same role lib/assignments.ts plays for the teacher and
// student screens. Every path here is under /admin, which the backend guards with
// [Authorize(Roles = "Admin")] at the controller level; nothing in this file is a security boundary.

// --- Users ---------------------------------------------------------------------------------------

export const listUsers = (query: UserQuery, signal?: AbortSignal) =>
  api.get<PagedResult<AdminUser>>("/admin/users", { ...query }, signal);

export const createUser = (body: CreateUserRequest) =>
  api.post<AdminUser>("/admin/users", body);

export const updateUser = (id: string, body: UpdateUserRequest) =>
  api.put<AdminUser>(`/admin/users/${id}`, body);

// 409 for a user with assignments or submissions on record, and for an admin deleting themselves.
export const deleteUser = (id: string) => api.delete(`/admin/users/${id}`);

// There is no GET /admin/users/{id} in the API — users are addressable only through the list. The edit
// form therefore finds its row by walking pages, the same approach findSubmission takes in
// lib/assignments.ts, so a deep-linked edit URL still works for someone on page 3.
export async function findUser(id: string, signal?: AbortSignal): Promise<AdminUser | null> {
  let page = 1;

  for (;;) {
    const result = await listUsers({ page, pageSize: MAX_PAGE_SIZE }, signal);

    const found = result.items.find((user) => user.id === id);
    if (found) return found;

    if (page >= result.totalPages || result.items.length === 0) return null;
    page += 1;
  }
}

// Every user of one role, for a picker. Capped at MAX_PAGE_SIZE because a dropdown has no sensible way
// to paginate — beyond 100 teachers this needs a searchable combobox, which is noted as a limitation
// rather than pretended away.
export const listAllOfRole = (role: "Teacher" | "Student", signal?: AbortSignal) =>
  listUsers({ role, page: 1, pageSize: MAX_PAGE_SIZE, sortBy: "fullName", sortDir: "asc" }, signal);

// --- Classes and subjects ------------------------------------------------------------------------

export const listClasses = (query: PagedQuery, signal?: AbortSignal) =>
  api.get<PagedResult<SchoolClass>>("/admin/classes", { ...query }, signal);

export const createClass = (body: CreateClassRequest) =>
  api.post<SchoolClass>("/admin/classes", body);

// The response carries `subjects`, so a class row already knows its own subjects — no second call.
export const addSubject = (classId: string, body: CreateSubjectRequest) =>
  api.post<{ id: string; name: string; classId: string }>(
    `/admin/classes/${classId}/subjects`,
    body,
  );

// Same page-walk as findUser: there is no GET /admin/classes/{id}, only the paged list.
export async function findClass(id: string, signal?: AbortSignal): Promise<SchoolClass | null> {
  let page = 1;

  for (;;) {
    const result = await listClasses({ page, pageSize: MAX_PAGE_SIZE }, signal);

    const found = result.items.find((item) => item.id === id);
    if (found) return found;

    if (page >= result.totalPages || result.items.length === 0) return null;
    page += 1;
  }
}

export const listAllClasses = (signal?: AbortSignal) =>
  listClasses({ page: 1, pageSize: MAX_PAGE_SIZE, sortBy: "code", sortDir: "asc" }, signal);

// --- Teacher assignments and enrolments ----------------------------------------------------------

export const assignTeacher = (body: CreateTeacherAssignmentRequest) =>
  api.post<TeacherAssignmentResponse>("/admin/teacher-assignments", body);

export const enrolStudent = (body: CreateEnrollmentRequest) =>
  api.post<EnrollmentResponse>("/admin/enrollments", body);

// The read halves. Added to the API for these screens: without them the two forms above would be
// write-only, so an admin could grant a teacher their class and have no way to confirm it landed.
export const listClassTeachers = (classId: string, query: PagedQuery, signal?: AbortSignal) =>
  api.get<PagedResult<TeacherAssignmentResponse>>(
    `/admin/classes/${classId}/teachers`,
    { ...query },
    signal,
  );

export const listClassStudents = (classId: string, query: PagedQuery, signal?: AbortSignal) =>
  api.get<PagedResult<EnrollmentResponse>>(
    `/admin/classes/${classId}/students`,
    { ...query },
    signal,
  );

// --- Read-only oversight -------------------------------------------------------------------------

// Unscoped by role: this is the one endpoint in the API that returns every teacher's drafts.
export const listAllAssignments = (query: AssignmentQuery, signal?: AbortSignal) =>
  api.get<PagedResult<AssignmentListItem>>("/admin/assignments", { ...query }, signal);

export const listAllSubmissions = (query: PagedQuery, signal?: AbortSignal) =>
  api.get<PagedResult<Submission>>("/admin/submissions", { ...query }, signal);
