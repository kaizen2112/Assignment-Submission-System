"use client";

import { useCallback, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { listAllSubmissions } from "@/lib/admin";
import { formatDateTime, formatMarks } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

const COLUMNS = 5;

// Read-only, for the same reason as the assignments oversight page: grading is a teacher action gated by
// rule 4, and the API has no admin grading endpoint. This page answers "what has been handed in and
// marked?" across the whole system, which no other screen can.
//
// GET /admin/submissions takes only page/pageSize/sortBy/sortDir — no status or assignment filter — so
// there are no filter controls here. Inventing client-side ones would filter the current page only and
// quietly lie about the totals.
export default function AdminSubmissionsPage() {
  const [page, setPage] = useState(1);

  const loader = useCallback(
    (signal: AbortSignal) =>
      listAllSubmissions({ page, pageSize: DEFAULT_PAGE_SIZE, sortDir: "desc" }, signal),
    [page],
  );

  const { data, error, loading } = useAsync(loader);

  return (
    <>
      <PageHeader
        title="All submissions"
        subtitle="Every submission in the system, newest first."
        crumbs={[{ label: "Admin" }, { label: "All submissions" }]}
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 />}
          title="No submissions yet"
          description="Submissions appear here once students start handing work in against published assignments."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TableWrap>
            <THead>
              <TR hover={false}>
                <TH>Student</TH>
                <TH>Assignment</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH align="right">Marks</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((submission) => (
                  <TR key={submission.id}>
                    <TDPrimary>
                      <span className="flex items-center gap-3">
                        <Avatar fullName={submission.studentName} size="sm" />
                        {submission.studentName}
                      </span>
                    </TDPrimary>

                    <TD className="text-gray-700">{submission.assignmentTitle}</TD>

                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <SubmissionStatusBadge status={submission.status} />
                        {/* Kept separate from status so grading a late submission does not erase that
                            it arrived late. */}
                        <LateBadge isLate={submission.isLate} />
                      </div>
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500">
                      {formatDateTime(submission.submittedAt)}
                    </TD>

                    <TD align="right" className="tabular-nums">
                      {formatMarks(submission.marks, submission.maxMarks)}
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
