"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { getAssignment, listSubmissions } from "@/lib/assignments";
import { formatDateTime, formatMarks } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

const COLUMNS = 6;

export default function AssignmentSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);

  // Two independent loads. The assignment is needed for the heading and for maxMarks; keeping them
  // separate means a paging click refetches only the submissions.
  const assignmentLoader = useCallback((signal: AbortSignal) => getAssignment(id, signal), [id]);
  const { data: assignment, error: assignmentError } = useAsync(assignmentLoader);

  const submissionsLoader = useCallback(
    (signal: AbortSignal) =>
      listSubmissions(id, { page, pageSize: DEFAULT_PAGE_SIZE }, signal),
    [id, page],
  );
  const { data, error, loading } = useAsync(submissionsLoader);

  const ungraded = data?.items.filter((s) => s.status !== "Graded").length ?? 0;

  return (
    <>
      <PageHeader
        title="Submissions"
        subtitle={
          assignment
            ? `${assignment.title} — ${assignment.className}, ${assignment.subjectName}`
            : undefined
        }
        backHref="/teacher/assignments"
        backLabel="Assignments"
      />

      {assignmentError && <Alert className="mb-4">{assignmentError}</Alert>}
      {error && <Alert className="mb-4">{error}</Alert>}

      {/* Counts only the current page, so it says so. Claiming a total would be wrong on page 2. */}
      {!loading && ungraded > 0 && (
        <Alert tone="info" className="mb-4">
          {ungraded} submission{ungraded === 1 ? "" : "s"} on this page still need{ungraded === 1 ? "s" : ""}{" "}
          grading.
        </Alert>
      )}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description={
            assignment?.status === "Draft"
              ? "This assignment is still a draft, so students cannot see or submit to it."
              : "Nothing has been submitted for this assignment yet."
          }
          action={
            <Link href="/teacher/assignments">
              <Button variant="secondary">Back to assignments</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH>Last updated</TH>
                <TH align="right">Marks</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((submission) => (
                  <TR key={submission.id}>
                    <TD className="font-medium text-slate-900">{submission.studentName}</TD>

                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <SubmissionStatusBadge status={submission.status} />
                        {/* Kept separate from status so grading a late submission does not erase
                            the fact that it arrived late. */}
                        <LateBadge isLate={submission.isLate} />
                      </div>
                    </TD>

                    <TD className="whitespace-nowrap">{formatDateTime(submission.submittedAt)}</TD>

                    <TD className="whitespace-nowrap">{formatDateTime(submission.updatedAt)}</TD>

                    <TD align="right" className="tabular-nums">
                      {formatMarks(submission.marks, submission.maxMarks)}
                    </TD>

                    <TD align="right">
                      <Link href={`/teacher/assignments/${id}/submissions/${submission.id}`}>
                        <Button size="sm" variant={submission.status === "Graded" ? "secondary" : "primary"}>
                          {submission.status === "Graded" ? "Review" : "Grade"}
                        </Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            )}
          </TableWrap>

          {data && <Pagination result={data} onPageChange={setPage} disabled={loading} />}
        </div>
      )}
    </>
  );
}
