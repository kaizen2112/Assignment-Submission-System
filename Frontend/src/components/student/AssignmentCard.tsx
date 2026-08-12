import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, LateBadge, SubjectBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { DeadlineLabel } from "@/components/ui/DeadlineLabel";
import { formatMarks } from "@/lib/utils";
import type { AssignmentListItem, Submission } from "@/types/api";

// One assignment as a tile. Cards rather than table rows for the student view because a student has a
// handful of assignments and a decision to make about each one — a table optimises for comparing many
// rows, which is the teacher's problem, not theirs.
//
// The whole card is the link, not just the arrow: a tile that lifts on hover but only responds in one
// corner is the most annoying kind of almost-interactive.
//
// No description. The list endpoint deliberately omits it — up to 5000 characters per row — and fetching
// each assignment individually to fill in a two-line preview would turn one request into N.
// Three states, not two, and the distinction is load-bearing:
//   Submission — known, show its status
//   null       — known to be unsubmitted, show "Not submitted"
//   undefined  — NOT KNOWN, show no chip at all
// The assignments list page has no submission data (that would be one request per card), so it omits the
// prop. Passing null there instead would confidently label submitted work as "Not submitted".
export function AssignmentCard({
  assignment,
  submission,
}: {
  assignment: AssignmentListItem;
  submission?: Submission | null;
}) {
  const submissionKnown = submission !== undefined;
  return (
    <Link
      href={`/student/assignments/${assignment.id}`}
      className="group flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:border-gray-200 hover:shadow-md"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <SubjectBadge>{assignment.subjectName}</SubjectBadge>

        {submissionKnown && (
          <div className="flex flex-wrap items-center gap-1">
            {/* "Not submitted" is a real state worth naming, so a known-missing submission still gets a
                chip rather than an empty corner. */}
            <SubmissionStatusBadge status={submission?.status ?? "NotSubmitted"} />
            {submission && <LateBadge isLate={submission.isLate} />}
          </div>
        )}
      </div>

      <h3 className="font-semibold text-gray-900">{assignment.title}</h3>

      <p className="mt-1 text-sm text-gray-500">
        {assignment.className} · {assignment.maxMarks} marks
      </p>

      {/* The payoff, once it exists. A student opening this dashboard after grading wants the number,
          and making them click through for it is the wrong default. */}
      {submission?.status === "Graded" && (
        <p className="mt-3 text-sm font-semibold tabular-nums text-green-700">
          {formatMarks(submission.marks, submission.maxMarks)}
        </p>
      )}

      {/* mt-auto so the footer sits at the bottom whatever the title's height — a grid of cards with
          ragged footers looks broken in a way nobody can name. */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineLabel deadline={assignment.deadline} />

          {/* Overdue plus late-allowed is the one case where a student can still act, so it is called
              out rather than left for them to discover by clicking. */}
          {assignment.isOverdue && assignment.allowLateSubmission && !submission && (
            <Badge tone="warning">Late OK</Badge>
          )}

          {/* Without submission data there is no status chip in the corner, so the only thing marking an
              overdue assignment would be the struck-through deadline. This restores that signal. */}
          {!submissionKnown && assignment.isOverdue && !assignment.allowLateSubmission && (
            <Badge tone="danger">Overdue</Badge>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 transition-colors duration-150 group-hover:text-indigo-700">
          View
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
