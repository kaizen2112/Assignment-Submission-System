"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, Inbox, PenLine } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconLink, RowActions } from "@/components/ui/IconButton";
import { Pagination } from "@/components/ui/Pagination";
import {
  TableSkeleton,
  TBody,
  TD,
  TDPrimary,
  TH,
  THead,
  TR,
  TableWrap,
} from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { getAssignment, listSubmissions } from "@/lib/assignments";
import { formatDateTime, formatMarks } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

const COLUMNS = 5;

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
        crumbs={[
          { label: "Assignments", href: "/teacher/assignments" },
          { label: assignment?.title ?? "Assignment" },
          { label: "Submissions" },
        ]}
      />

      {assignmentError && <Alert className="mb-6">{assignmentError}</Alert>}
      {error && <Alert className="mb-6">{error}</Alert>}

      {/* Counts only the current page, so it says so. Claiming a total would be wrong on page 2. */}
      {!loading && ungraded > 0 && (
        <Alert tone="info" className="mb-6">
          {ungraded} submission{ungraded === 1 ? "" : "s"} on this page still need{ungraded === 1 ? "s" : ""}{" "}
          grading.
        </Alert>
      )}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
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
        <div className="flex flex-col gap-4">
          <TableWrap>
            <THead>
              <TR hover={false}>
                <TH>Student</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH align="right">Marks</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((submission) => {
                  const gradeHref = `/teacher/assignments/${id}/submissions/${submission.id}`;
                  const isGraded = submission.status === "Graded";

                  return (
                    <TR key={submission.id}>
                      <TDPrimary>
                        <span className="flex items-center gap-3">
                          <Avatar fullName={submission.studentName} size="sm" />
                          <Link
                            href={gradeHref}
                            className="transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {submission.studentName}
                          </Link>
                        </span>
                      </TDPrimary>

                      <TD>
                        <div className="flex flex-wrap items-center gap-1">
                          <SubmissionStatusBadge status={submission.status} />
                          {/* Kept separate from status so grading a late submission does not erase
                              the fact that it arrived late. */}
                          <LateBadge isLate={submission.isLate} />
                        </div>
                      </TD>

                      <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        <span className="block">{formatDateTime(submission.submittedAt)}</span>
                        {submission.updatedAt && (
                          <span className="block text-gray-400 dark:text-gray-500">
                            edited {formatDateTime(submission.updatedAt)}
                          </span>
                        )}
                      </TD>

                      <TD align="right" className="tabular-nums">
                        {formatMarks(submission.marks, submission.maxMarks)}
                      </TD>

                      <TD align="right">
                        {/* Ungraded rows keep a full button: grading is the whole reason this page
                            exists, so the primary action is not hidden behind a hover. Graded rows get
                            the quiet icon, because reviewing is the exception. */}
                        {isGraded ? (
                          <RowActions>
                            <IconLink href={gradeHref} label="Review grade" icon={<Eye />} />
                          </RowActions>
                        ) : (
                          <Link href={gradeHref}>
                            <Button size="sm" icon={<PenLine />}>
                              Grade
                            </Button>
                          </Link>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            )}
          </TableWrap>

          {data && <Pagination result={data} onPageChange={setPage} disabled={loading} />}
        </div>
      )}
    </>
  );
}
