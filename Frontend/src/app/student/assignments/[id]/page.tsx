"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award, CalendarClock, FileText, Target, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubmissionForm } from "@/components/student/SubmissionForm";
import { Alert } from "@/components/ui/Alert";
import { Badge, LateBadge, OverdueBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { Skeleton, SkeletonRegion, TextSkeleton } from "@/components/ui/Skeleton";
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
        <SkeletonRegion label="Loading assignment" className="flex flex-col gap-6">
          <Card className="p-6">
            <div className="mb-6 grid gap-6 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
            <TextSkeleton lines={4} />
          </Card>
          <Card className="p-6">
            <Skeleton className="mb-4 h-4 w-40" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </Card>
        </SkeletonRegion>
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
        <Alert className="mb-6">{error ?? "This assignment could not be found."}</Alert>
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
        crumbs={[
          { label: "Assignments", href: "/student/assignments" },
          { label: assignment.title },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <OverdueBadge isOverdue={assignment.isOverdue} />
            {assignment.allowLateSubmission && <Badge tone="info">Late allowed</Badge>}
            {submission && <SubmissionStatusBadge status={submission.status} />}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        {/* Marks and feedback, shown only once graded. This is the payoff of the whole flow, so it sits
            first rather than below the answer.

            Green card rather than the usual white: this is the one panel in the app a student is looking
            for, and it should be findable without reading a heading. */}
        {submission?.status === "Graded" && (
          <section
            aria-label="Your grade"
            className="rounded-xl border border-green-200 bg-green-50 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700"
                >
                  <Award className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-green-900">Your grade</h2>
                  <p className="mt-0.5 text-xs text-green-700">
                    Graded {formatDateTime(submission.gradedAt)}
                  </p>
                </div>
              </div>

              <p className="text-3xl font-bold tabular-nums text-green-900">
                {formatMarks(submission.marks, submission.maxMarks)}
              </p>
            </div>

            {submission.feedback ? (
              <div className="mt-5 border-t border-green-200 pt-5">
                <CardLabel as="h3" className="text-green-700">
                  Feedback
                </CardLabel>
                <p className="mt-2 whitespace-pre-wrap wrap-break-word border-l-2 border-green-300 pl-4 text-sm leading-relaxed text-green-900">
                  {submission.feedback}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-green-800">
                Your teacher left no written feedback.
              </p>
            )}
          </section>
        )}

        <Card as="section" aria-label="Assignment details" className="p-6">
          <dl className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: <CalendarClock />,
                label: "Deadline",
                value: formatDateTime(assignment.deadline),
                sub: formatRelative(assignment.deadline),
              },
              {
                icon: <Target />,
                label: "Max marks",
                value: String(assignment.maxMarks),
              },
              {
                icon: <Timer />,
                label: "Late submissions",
                value: assignment.allowLateSubmission ? "Accepted" : "Not accepted",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 [&>svg]:size-4"
                >
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{item.value}</dd>
                  {item.sub && <dd className="text-xs text-gray-500">{item.sub}</dd>}
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="mb-3 flex items-center gap-2">
              <FileText aria-hidden="true" className="size-3.5 text-gray-400" />
              <CardLabel as="h2">Description</CardLabel>
            </div>
            {/* whitespace-pre-wrap: the teacher's line breaks are meaningful, and rendering this as
                HTML would both lose them and invite injection. */}
            <p className="whitespace-pre-wrap wrap-break-word border-l-2 border-gray-200 pl-4 text-sm leading-relaxed text-gray-700">
              {assignment.description}
            </p>
          </div>
        </Card>

        <Card as="section" aria-label="Your submission" className="p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              {submission ? "Your submission" : "Submit your answer"}
            </h2>

            {submission && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
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
            <div className="mt-6 border-t border-gray-100 pt-6">
              <CardLabel as="h3">Your answer</CardLabel>
              <p className="mt-2 whitespace-pre-wrap wrap-break-word border-l-2 border-gray-200 pl-4 text-sm leading-relaxed text-gray-700">
                {submission.answerText}
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
