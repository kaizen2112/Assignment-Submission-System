import { api, ApiError } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { AssignmentListItem, PagedResult, SchoolClass, Submission } from "@/types/api";

// Dashboard statistics and the handful of rows each dashboard shows, assembled from the existing list
// endpoints.
//
// There is no aggregate/stats endpoint in the API, so every number here is derived from a paginated
// list. Two different techniques, and the difference matters:
//
//  1. Anything the server can filter is one cheap request: ask for a small page and read `totalCount`.
//     The count comes from a SQL COUNT, not from the payload — so asking for 5 rows instead of 1 costs
//     nothing extra and hands the dashboard its table for free. That is why the "recent" lists below add
//     no requests: they are the rows of a call that was already being made and thrown away.
//
//  2. "Awaiting grading" and a student's own submission state cannot be filtered server-side — the
//     submission endpoints take only page/pageSize/sortBy/sortDir, with no status filter, and
//     submissions are addressable only per assignment. Those stats therefore need one request per
//     assignment, run in parallel and capped. This is a genuine N+1 and the honest fix is a backend
//     aggregate endpoint; it remains open. The cap means the number can be a floor rather than an exact
//     count, which is why the callers receive an `approximate` flag instead of a silently wrong total.

const COUNT_ONLY = { page: 1, pageSize: 1 } as const;

// How many rows a dashboard table shows. Small on purpose: a dashboard is a summary with a link to the
// full list, not a second copy of it.
const RECENT_LIMIT = 5;

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

// The same request as `count`, but keeping the rows. Used wherever a dashboard needs both the total and
// a few examples of it — which is every table below.
function page<T>(
  path: string,
  query: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<PagedResult<T>> {
  return api.get<PagedResult<T>>(path, { page: 1, pageSize: RECENT_LIMIT, ...query }, signal);
}

// --- Admin ---------------------------------------------------------------------------------------

export interface AdminStats {
  users: number;
  teachers: number;
  students: number;
  classes: number;
  subjects: number;
  assignments: number;
  submissions: number;
  // The newest submissions system-wide, for the activity table.
  recentSubmissions: Submission[];
}

// Six parallel requests, exactly as before. Three of them now ask for a handful of rows rather than one,
// which is what feeds the subject count and the activity table without a seventh call.
export async function loadAdminStats(signal?: AbortSignal): Promise<AdminStats> {
  const [users, teachers, students, classPage, assignments, submissionPage] = await Promise.all([
    count("/admin/users", {}, signal),
    count("/admin/users", { role: "Teacher" }, signal),
    count("/admin/users", { role: "Student" }, signal),
    // Subjects are nested inside each class — there is no subjects endpoint to count — so the only way
    // to total them is to sum over a page of classes. Capped, so with more than 100 classes this becomes
    // a floor; the classes count itself stays exact because it comes from totalCount.
    api.get<PagedResult<SchoolClass>>(
      "/admin/classes",
      { page: 1, pageSize: FAN_OUT_LIMIT },
      signal,
    ),
    count("/admin/assignments", {}, signal),
    page<Submission>("/admin/submissions", { sortDir: "desc" }, signal),
  ]);

  return {
    users,
    teachers,
    students,
    classes: classPage.totalCount,
    subjects: classPage.items.reduce((total, c) => total + c.subjects.length, 0),
    assignments,
    submissions: submissionPage.totalCount,
    recentSubmissions: submissionPage.items,
  };
}

// --- Teacher -------------------------------------------------------------------------------------

export interface TeacherStats {
  assignments: number;
  drafts: number;
  published: number;
  // null when the fan-out failed. Distinct from 0, which means "nothing left to grade".
  awaitingGrading: number | null;
  approximate: boolean;
  // The teacher's own most recent assignments, drafts included.
  recentAssignments: AssignmentListItem[];
  // Submissions still needing a mark, newest first, with the assignment they belong to.
  pending: PendingSubmission[];
}

export interface PendingSubmission {
  submission: Submission;
  assignmentId: string;
}

export async function loadTeacherStats(signal?: AbortSignal): Promise<TeacherStats> {
  // GET /assignments is already scoped to the calling teacher by AssignmentService (rule 4), so these
  // are their own assignments — no client-side filtering by teacher id, which could not be trusted.
  const [recentPage, drafts, published] = await Promise.all([
    page<AssignmentListItem>("/assignments", { sortBy: "createdAt", sortDir: "desc" }, signal),
    count("/assignments", { status: "Draft" }, signal),
    count("/assignments", { status: "Published" }, signal),
  ]);

  let awaitingGrading: number | null = null;
  let approximate = false;
  let pending: PendingSubmission[] = [];

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
        const outstanding = submissions.items.filter((s) => s.status !== "Graded");

        return {
          outstanding: outstanding.length,
          rows: outstanding.map((submission) => ({ submission, assignmentId: assignment.id })),
          truncated,
        };
      }),
    );

    awaitingGrading = perAssignment.reduce((total, r) => total + r.outstanding, 0);
    approximate = approximate || perAssignment.some((r) => r.truncated);

    // Newest first: the queue a teacher works through is chronological, and the oldest submission is
    // the one they have already seen at the bottom of the list.
    pending = perAssignment
      .flatMap((r) => r.rows)
      .sort((a, b) => Date.parse(b.submission.submittedAt) - Date.parse(a.submission.submittedAt))
      .slice(0, RECENT_LIMIT);
  } catch (error) {
    // An aborted request is a navigation, not a failure — let the caller's abort handling see it.
    if (isAbort(error)) throw error;

    // Any other failure leaves this one stat unknown. The counts above are already loaded and are still
    // worth showing, so this does not fail the whole dashboard.
    awaitingGrading = null;
  }

  return {
    assignments: recentPage.totalCount,
    drafts,
    published,
    awaitingGrading,
    approximate,
    recentAssignments: recentPage.items,
    pending,
  };
}

// --- Student -------------------------------------------------------------------------------------

// An assignment paired with this student's submission to it, or null if they have not submitted. The
// dashboard splits on exactly this: `submission === null` is the to-do list.
export interface StudentAssignment {
  assignment: AssignmentListItem;
  submission: Submission | null;
}

export interface StudentStats {
  available: number;
  submitted: number | null;
  graded: number | null;
  pending: number | null;
  approximate: boolean;
  // Every assignment on the fetched page with its submission state. Not a subset — the dashboard needs
  // to sort and split it, and this data is already in hand.
  items: StudentAssignment[];
}

export async function loadStudentStats(signal?: AbortSignal): Promise<StudentStats> {
  // Students only ever see Published assignments for classes they are enrolled in — enforced in
  // AssignmentService (rules 3 and 6), not here.
  const available = await count("/assignments", {}, signal);

  let submitted: number | null = null;
  let graded: number | null = null;
  let pending: number | null = null;
  let approximate = false;
  let items: StudentAssignment[] = [];

  try {
    const assignmentPage = await api.get<PagedResult<AssignmentListItem>>(
      "/assignments",
      // Soonest deadline first: for a student the ordering *is* the priority.
      { page: 1, pageSize: FAN_OUT_LIMIT, sortBy: "deadline", sortDir: "asc" },
      signal,
    );

    approximate = assignmentPage.totalCount > assignmentPage.items.length;

    const mine = await Promise.all(
      assignmentPage.items.map((assignment) => loadMySubmission(assignment.id, signal)),
    );

    items = assignmentPage.items.map((assignment, index) => ({
      assignment,
      submission: mine[index] ?? null,
    }));

    const found = mine.filter((s): s is Submission => s !== null);

    submitted = found.length;
    graded = found.filter((s) => s.status === "Graded").length;
    // Derived from the page actually inspected, not from `available`, so a truncated fan-out cannot
    // produce a negative "pending".
    pending = assignmentPage.items.length - submitted;
  } catch (error) {
    if (isAbort(error)) throw error;

    submitted = null;
    graded = null;
    pending = null;
  }

  return { available, submitted, graded, pending, approximate, items };
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
