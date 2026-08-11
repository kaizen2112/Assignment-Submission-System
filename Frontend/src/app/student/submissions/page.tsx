"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { getMySubmissions } from "@/lib/assignments";
import { formatDateTime, formatMarks } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

const COLUMNS = 6;

export default function MySubmissionsPage() {
  const [page, setPage] = useState(1);

  // getMySubmissions is a module-level function, so it is stable and the effect runs once. Paging here
  // is client-side, unlike every other list in the app — see the note below.
  const { data, error, loading } = useAsync(getMySubmissions);

  const all = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / DEFAULT_PAGE_SIZE));

  // Clamped rather than trusted: if the list shrinks between renders, `page` could point past the end
  // and render an empty table on a non-empty result.
  const safePage = Math.min(page, totalPages);
  const visible = all.slice((safePage - 1) * DEFAULT_PAGE_SIZE, safePage * DEFAULT_PAGE_SIZE);

  // Client-side because the API has no student-scoped submissions endpoint — this list is assembled by
  // fanning out over assignments (see getMySubmissions), so there is no server page to ask for. The
  // envelope is built by hand to reuse the same Pagination component as the server-paged lists.
  const pageEnvelope = {
    page: safePage,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: all.length,
    totalPages,
  };

  return (
    <>
      <PageHeader
        title="My submissions"
        subtitle="Everything you have handed in, newest first, with marks once graded."
      />

      {error && <Alert className="mb-4">{error}</Alert>}

      {data?.approximate && (
        <Alert tone="warning" className="mb-4">
          You have more assignments than fit in one page, so this list may not include everything.
        </Alert>
      )}

      {!loading && !error && all.length === 0 ? (
        <EmptyState
          title="You have not submitted anything yet"
          description="Open an assignment to write and submit your answer."
          action={
            <Link href="/student/assignments">
              <Button>View assignments</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Assignment</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH align="right">Marks</TH>
                <TH>Feedback</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {visible.map((submission) => (
                  <TR key={submission.id}>
                    <TD className="font-medium text-slate-900">{submission.assignmentTitle}</TD>

                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <SubmissionStatusBadge status={submission.status} />
                        <LateBadge isLate={submission.isLate} />
                      </div>
                    </TD>

                    <TD className="whitespace-nowrap">{formatDateTime(submission.submittedAt)}</TD>

                    <TD align="right" className="tabular-nums">
                      {/* An em dash until graded — 0 is a real mark, so a falsy check here would show
                          a dash for a legitimate zero. */}
                      {formatMarks(submission.marks, submission.maxMarks)}
                    </TD>

                    <TD className="max-w-64">
                      {submission.feedback ? (
                        // line-clamp so one long comment cannot stretch the row; the full text is on
                        // the assignment page.
                        <span className="line-clamp-2 text-xs text-slate-600">
                          {submission.feedback}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TD>

                    <TD align="right">
                      <Link href={`/student/assignments/${submission.assignmentId}`}>
                        <Button size="sm" variant="secondary">
                          View
                        </Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            )}
          </TableWrap>

          <Pagination result={pageEnvelope} onPageChange={setPage} disabled={loading} />
        </div>
      )}
    </>
  );
}
