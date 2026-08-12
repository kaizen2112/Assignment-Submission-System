import { api, ApiError } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type {
  Assignment,
  AssignmentListItem,
  AssignmentQuery,
  CreateAssignmentRequest,
  GradeSubmissionRequest,
  PagedResult,
  Submission,
  SubmitAnswerRequest,
  TeachingScope,
  UpdateAssignmentRequest,
} from "@/types/api";

// One place that knows the assignment and submission URLs. Pages call these instead of building paths,
// so a route change is a one-line edit rather than a hunt through JSX.

export const listAssignments = (query: AssignmentQuery, signal?: AbortSignal) =>
  api.get<PagedResult<AssignmentListItem>>("/assignments", { ...query }, signal);

export const getAssignment = (id: string, signal?: AbortSignal) =>
  api.get<Assignment>(`/assignments/${id}`, undefined, signal);

export const createAssignment = (body: CreateAssignmentRequest) =>
  api.post<Assignment>("/assignments", body);

export const updateAssignment = (id: string, body: UpdateAssignmentRequest) =>
  api.put<Assignment>(`/assignments/${id}`, body);

// PATCH, not PUT: publishing is a state transition, not a replacement of the resource.
export const publishAssignment = (id: string) =>
  api.patch<Assignment>(`/assignments/${id}/publish`);

// POST, because it creates a new assignment rather than changing this one — the original is untouched and
// the response is the copy. Always a Draft with a placeholder deadline a week out, which is why callers send
// the teacher to the edit form afterwards.
export const duplicateAssignment = (id: string) =>
  api.post<Assignment>(`/assignments/${id}/duplicate`);

// 409 when the assignment already has submissions — assumption A5. Deleting would cascade and destroy
// graded student work, so the API refuses rather than doing it quietly.
export const deleteAssignment = (id: string) => api.delete(`/assignments/${id}`);

// The class+subject pairs this teacher may create for. Fetched at MAX_PAGE_SIZE because a picker needs
// every option at once — there is no sensible way to paginate a dropdown.
export const getTeachingScope = (signal?: AbortSignal) =>
  api.get<PagedResult<TeachingScope>>(
    "/assignments/teaching-scope",
    { page: 1, pageSize: MAX_PAGE_SIZE },
    signal,
  );

// --- Submissions ---------------------------------------------------------------------------------

export const listSubmissions = (
  assignmentId: string,
  query: { page?: number; pageSize?: number },
  signal?: AbortSignal,
) =>
  api.get<PagedResult<Submission>>(
    `/assignments/${assignmentId}/submissions`,
    { ...query },
    signal,
  );

export const gradeSubmission = (
  assignmentId: string,
  submissionId: string,
  body: GradeSubmissionRequest,
) =>
  api.patch<Submission>(
    `/assignments/${assignmentId}/submissions/${submissionId}/grade`,
    body,
  );

// --- Student-facing submissions ------------------------------------------------------------------

export const submitAnswer = (assignmentId: string, body: SubmitAnswerRequest) =>
  api.post<Submission>(`/assignments/${assignmentId}/submissions`, body);

export const updateMySubmission = (assignmentId: string, body: SubmitAnswerRequest) =>
  api.put<Submission>(`/assignments/${assignmentId}/submissions/mine`, body);

// 404 is the API's answer for "you have not submitted to this one" — an expected outcome, not an error,
// so it maps to null rather than propagating. Same convention as lib/dashboard.ts.
export async function getMySubmission(
  assignmentId: string,
  signal?: AbortSignal,
): Promise<Submission | null> {
  try {
    return await api.get<Submission>(
      `/assignments/${assignmentId}/submissions/mine`,
      undefined,
      signal,
    );
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export interface MySubmissions {
  items: Submission[];
  // True when the assignment page was truncated, so this is a subset rather than everything.
  approximate: boolean;
}

// Every submission this student has made.
//
// There is no `GET /submissions/mine` in the API — submissions are addressable only per assignment — so
// this fans out one request per assignment, in parallel, capped at MAX_PAGE_SIZE. Same N+1 as the
// dashboard stats, and flagged for the same Phase 6 fix: a student-scoped submissions list endpoint
// would replace this with one paginated call. Deliberately not added during a frontend step, because
// unlike the teaching-scope gap this one is merely inefficient rather than impossible.
export async function getMySubmissions(signal?: AbortSignal): Promise<MySubmissions> {
  const page = await listAssignments({ page: 1, pageSize: MAX_PAGE_SIZE }, signal);

  const found = await Promise.all(
    page.items.map((assignment) => getMySubmission(assignment.id, signal)),
  );

  return {
    // Newest first: a student cares about what they just handed in, and about new marks.
    items: found
      .filter((s): s is Submission => s !== null)
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
    approximate: page.totalCount > page.items.length,
  };
}

// A single submission is only reachable through its assignment's list — there is no
// GET /submissions/{id} for teachers. The grade page therefore finds its row by paging through the
// assignment's submissions. Capped at MAX_PAGE_SIZE per request; it walks pages until it finds the id or
// runs out, which keeps a deep-linked grade URL working rather than 404ing on page 2.
export async function findSubmission(
  assignmentId: string,
  submissionId: string,
  signal?: AbortSignal,
): Promise<Submission | null> {
  let page = 1;

  for (;;) {
    const result = await listSubmissions(
      assignmentId,
      { page, pageSize: MAX_PAGE_SIZE },
      signal,
    );

    const found = result.items.find((s) => s.id === submissionId);
    if (found) return found;

    if (page >= result.totalPages || result.items.length === 0) return null;
    page += 1;
  }
}
