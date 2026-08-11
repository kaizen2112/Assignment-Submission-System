"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubmissionForm } from "@/components/student/SubmissionForm";
import { Alert } from "@/components/ui/Alert";
import { Badge, LateBadge, OverdueBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { getAssignment, getMySubmission } from "@/lib/assignments";
import { formatDateTime, formatMarks, formatRelative } from "@/lib/utils";
import type { Submission } from "@/types/api";

export default function StudentAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Both in one loader, so the page never renders the form against an assignment whose submission is
  // still unknown — which would briefly show "Submit" to a student who has already submitted.
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const [assignment, submission] = await Promise.all([
        getAssignment(id, signal),
        getMySubmission(id, signal),
      ]);

      return { assignment, submission };
    },
    [id],
  );

  const { data, error, loading } = useAsync(loader);

  // Updated in place from the API's own response after a submit, rather than refetching. Starts
  // undefined to mean "no local override yet"; null is a real value here ("not submitted").
  const [savedOverride, setSavedOverride] = useState<Submission | undefined>(undefined);
  const submission = savedOverride !== undefined ? savedOverride : (data?.submission ?? null);

  if (loading) {
    return (
      <>
        <PageHeader title="Assignment" backHref="/student/assignments" backLabel="Assignments" />
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      </>
    );
  }

  // A 404 here also covers a draft, and an assignment for a class this student is not enrolled in. The
  // API deliberately does not distinguish those from "does not exist" (assumption A7), so neither does
  // this message — telling a student that a hidden assignment exists would defeat the point.
  if (error || !data) {
    return (
      <>
        <PageHeader title="Assignment" backHref="/student/assignments" backLabel="Assignments" />
        <Alert className="mb-4">{error ?? "This assignment could not be found."}</Alert>
        <Link href="/student/assignments">
          <Button variant="secondary">Back to assignments</Button>
        </Link>
      </>
    );
  }

  const { assignment } = data;

  return (
    <>
      <PageHeader
        title={assignment.title}
        subtitle={`${assignment.className} — ${assignment.subjectName}`}
        backHref="/student/assignments"
        backLabel="Assignments"
        action={
          <div className="flex flex-wrap items-center gap-1">
            <OverdueBadge isOverdue={assignment.isOverdue} />
            {assignment.allowLateSubmission && <Badge tone="info">Late allowed</Badge>}
            {submission && <SubmissionStatusBadge status={submission.status} />}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <section aria-label="Assignment details" className="rounded-lg border border-slate-200 bg-white p-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Deadline</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDateTime(assignment.deadline)}</dd>
              <dd className="text-xs text-slate-500">{formatRelative(assignment.deadline)}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Max marks</dt>
              <dd className="mt-1 text-sm tabular-nums text-slate-900">{assignment.maxMarks}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Late submissions
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {assignment.allowLateSubmission ? "Accepted" : "Not accepted"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</h2>
            {/* whitespace-pre-wrap: the teacher's line breaks are meaningful, and rendering this as
                HTML would both lose them and invite injection. */}
            <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-slate-800">
              {assignment.description}
            </p>
          </div>
        </section>

        {/* Marks and feedback, shown only once graded. This is the payoff of the whole flow, so it sits
            above the answer rather than below it. */}
        {submission?.status === "Graded" && (
          <section
            aria-label="Your grade"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-emerald-900">Your grade</h2>
              <p className="text-2xl font-semibold tabular-nums text-emerald-900">
                {formatMarks(submission.marks, submission.maxMarks)}
              </p>
            </div>

            <p className="mt-1 text-xs text-emerald-800">
              Graded {formatDateTime(submission.gradedAt)}
            </p>

            {submission.feedback ? (
              <div className="mt-3 border-t border-emerald-200 pt-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  Feedback
                </h3>
                <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-emerald-900">
                  {submission.feedback}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-emerald-800">Your teacher left no written feedback.</p>
            )}
          </section>
        )}

        <section aria-label="Your submission" className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {submission ? "Your submission" : "Submit your answer"}
            </h2>

            {submission && (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <LateBadge isLate={submission.isLate} />
                Submitted {formatDateTime(submission.submittedAt)}
                {submission.updatedAt && ` · edited ${formatDateTime(submission.updatedAt)}`}
              </p>
            )}
          </div>

          {/* The form owns every "can I still act?" decision — see resolveMode in SubmissionForm. When
              it renders read-only, the answer is displayed here instead so a locked submission is still
              visible to its author. */}
          <SubmissionForm
            assignment={assignment}
            submission={submission}
            onSaved={setSavedOverride}
          />

          {submission && (assignment.isOverdue || submission.status === "Graded") && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Your answer
              </h3>
              <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-slate-800">
                {submission.answerText}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
