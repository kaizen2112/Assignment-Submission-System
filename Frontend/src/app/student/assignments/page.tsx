"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge, OverdueBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { listAssignments } from "@/lib/assignments";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

const COLUMNS = 5;

export default function StudentAssignmentsPage() {
  const [page, setPage] = useState(1);

  // No status filter and no client-side scoping: GET /assignments is already scoped for a student by
  // AssignmentService — published only (rule 6), and only for classes they are enrolled in (rule 3).
  // Filtering here would be both redundant and untrustworthy.
  const loader = useCallback(
    (signal: AbortSignal) =>
      listAssignments(
        { page, pageSize: DEFAULT_PAGE_SIZE, sortBy: "deadline", sortDir: "asc" },
        signal,
      ),
    [page],
  );

  const { data, error, loading } = useAsync(loader);

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Everything published for your classes, soonest deadline first."
      />

      {error && <Alert className="mb-4">{error}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Nothing has been published for your classes. Check back later."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Class / Subject</TH>
                <TH>Deadline</TH>
                <TH align="right">Max marks</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((assignment) => (
                  <TR key={assignment.id}>
                    <TD className="font-medium text-slate-900">{assignment.title}</TD>

                    <TD>
                      <span className="block">{assignment.className}</span>
                      <span className="block text-xs text-slate-500">{assignment.subjectName}</span>
                    </TD>

                    <TD className="whitespace-nowrap">
                      <span className="block">{formatDateTime(assignment.deadline)}</span>
                      {/* The countdown, via Intl.RelativeTimeFormat: "in 3 days" / "2 days ago". More
                          use to a student than the timestamp alone, and it localises for free. */}
                      <span className="block text-xs text-slate-500">
                        {formatRelative(assignment.deadline)}
                      </span>
                    </TD>

                    <TD align="right" className="tabular-nums">
                      {assignment.maxMarks}
                    </TD>

                    <TD align="right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <OverdueBadge isOverdue={assignment.isOverdue} />

                        {/* Overdue plus late-allowed is the one case where a student can still act, so
                            it is called out rather than left for them to discover by clicking. */}
                        {assignment.isOverdue && assignment.allowLateSubmission && (
                          <Badge tone="warning">Late OK</Badge>
                        )}

                        <Link href={`/student/assignments/${assignment.id}`}>
                          <Button size="sm" variant="secondary">
                            Open
                          </Button>
                        </Link>
                      </div>
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
