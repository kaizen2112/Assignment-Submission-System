import { api } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type {
  Assignment,
  AssignmentListItem,
  AssignmentQuery,
  CreateAssignmentRequest,
  GradeSubmissionRequest,
  PagedResult,
  Submission,
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
