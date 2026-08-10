import { api, ApiError } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { AssignmentListItem, PagedResult, Submission } from "@/types/api";

// Dashboard statistics, assembled from the existing list endpoints.
//
// There is no aggregate/stats endpoint in the API, so every number here is derived from a paginated
// list. Two different techniques, and the difference matters:
//
//  1. Anything the server can filter is one cheap request: ask for pageSize=1 and read `totalCount`,
//     throwing the single returned row away. The count comes from a SQL COUNT, not from the payload.
//
//  2. "Awaiting grading" and a student's own submission state cannot be filtered server-side — the
//     submission endpoints take only page/pageSize/sortBy/sortDir, with no status filter, and
//     submissions are addressable only per assignment. Those stats therefore need one request per
//     assignment, run in parallel and capped. This is a genuine N+1 and the honest fix is a backend
//     aggregate endpoint; it is flagged for Phase 6 rather than smuggled in during a frontend step.
//     The cap means the number can be a floor rather than an exact count, which is why the callers
//     receive an `approximate` flag instead of a silently wrong total.

const COUNT_ONLY = { page: 1, pageSize: 1 } as const;

// One page of assignments to fan out over. 100 is the server's MAX_PAGE_SIZE — asking for more is a
// 400, not a larger page.
const FAN_OUT_LIMIT = MAX_PAGE_SIZE;

// Reads totalCount off a list endpoint without transferring the list.
async function count(
  path: string,
  query: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<number> {
  const page = await api.get<PagedResult<unknown>>(path, { ...query, ...COUNT_ONLY }, signal);
  return page.totalCount;
}

// --- Admin ---------------------------------------------------------------------------------------

export interface AdminStats {
  users: number;
  teachers: number;
  students: number;
  classes: number;
  assignments: number;
  submissions: number;
}

// Every one of these is server-filterable, so the whole dashboard is six parallel COUNT queries.
export async function loadAdminStats(signal?: AbortSignal): Promise<AdminStats> {
  const [users, teachers, students, classes, assignments, submissions] = await Promise.all([
    count("/admin/users", {}, signal),
    count("/admin/users", { role: "Teacher" }, signal),
    count("/admin/users", { role: "Student" }, signal),
    count("/admin/classes", {}, signal),
    count("/admin/assignments", {}, signal),
    count("/admin/submissions", {}, signal),
  ]);

  return { users, teachers, students, classes, assignments, submissions };
}

// --- Teacher -------------------------------------------------------------------------------------

export interface TeacherStats {
  assignments: number;
  drafts: number;
  published: number;
  // null when the fan-out failed. Distinct from 0, which means "nothing left to grade".
  awaitingGrading: number | null;
  approximate: boolean;
}

export async function loadTeacherStats(signal?: AbortSignal): Promise<TeacherStats> {
  // GET /assignments is already scoped to the calling teacher by AssignmentService (rule 4), so these
  // are their own assignments — no client-side filtering by teacher id, which could not be trusted.
  const [assignments, drafts, published] = await Promise.all([
    count("/assignments", {}, signal),
    count("/assignments", { status: "Draft" }, signal),
    count("/assignments", { status: "Published" }, signal),
  ]);

  let awaitingGrading: number | null = null;
  let approximate = false;

  try {
    // Only published assignments can have submissions — a student cannot submit to a draft (rule 6) —
    // so drafts are skipped rather than fetched and found empty.
    const publishedPage = await api.get<PagedResult<AssignmentListItem>>(
      "/assignments",
      { status: "Published", page: 1, pageSize: FAN_OUT_LIMIT },
      signal,
    );

    approximate = publishedPage.totalCount > publishedPage.items.length;

    const perAssignment = await Promise.all(
      publishedPage.items.map(async (assignment) => {
        const submissions = await api.get<PagedResult<Submission>>(
          `/assignments/${assignment.id}/submissions`,
          { page: 1, pageSize: MAX_PAGE_SIZE },
          signal,
        );

        // A truncated submission page also makes the total a floor.
        const truncated = submissions.totalCount > submissions.items.length;

        // Anything not yet Graded still needs the teacher. Covers both Submitted and Late, which is
        // why this counts by exclusion rather than listing the two statuses — a new status added later
        // would still be counted as outstanding rather than silently ignored.
        return {
          outstanding: submissions.items.filter((s) => s.status !== "Graded").length,
          truncated,
        };
      }),
    );

    awaitingGrading = perAssignment.reduce((total, r) => total + r.outstanding, 0);
    approximate = approximate || perAssignment.some((r) => r.truncated);
  } catch (error) {
    // An aborted request is a navigation, not a failure — let the caller's abort handling see it.
    if (isAbort(error)) throw error;

    // Any other failure leaves this one stat unknown. The three counts above are already loaded and
    // are still worth showing, so this does not fail the whole dashboard.
    awaitingGrading = null;
  }

  return { assignments, drafts, published, awaitingGrading, approximate };
}

// --- Student -------------------------------------------------------------------------------------

export interface StudentStats {
  available: number;
  submitted: number | null;
  graded: number | null;
  pending: number | null;
  approximate: boolean;
}

export async function loadStudentStats(signal?: AbortSignal): Promise<StudentStats> {
  // Students only ever see Published assignments for classes they are enrolled in — enforced in
  // AssignmentService (rules 3 and 6), not here.
  const available = await count("/assignments", {}, signal);

  let submitted: number | null = null;
  let graded: number | null = null;
  let pending: number | null = null;
  let approximate = false;

  try {
    const page = await api.get<PagedResult<AssignmentListItem>>(
      "/assignments",
      { page: 1, pageSize: FAN_OUT_LIMIT },
      signal,
    );

    approximate = page.totalCount > page.items.length;

    const mine = await Promise.all(
      page.items.map((assignment) => loadMySubmission(assignment.id, signal)),
    );

    const found = mine.filter((s): s is Submission => s !== null);

    submitted = found.length;
    graded = found.filter((s) => s.status === "Graded").length;
    // Derived from the page actually inspected, not from `available`, so a truncated fan-out cannot
    // produce a negative "pending".
    pending = page.items.length - submitted;
  } catch (error) {
    if (isAbort(error)) throw error;

    submitted = null;
    graded = null;
    pending = null;
  }

  return { available, submitted, graded, pending, approximate };
}

// 404 is the API's answer for "this student has not submitted to this assignment" — an expected
// outcome, not an error, so it maps to null rather than propagating.
async function loadMySubmission(
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

// fetch() rejects an aborted request with a DOMException named "AbortError", not an ApiError — so an
// abort would otherwise be swallowed by the catch blocks above and reported as a failed stat.
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
