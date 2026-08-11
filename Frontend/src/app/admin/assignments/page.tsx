"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge, OverdueBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { listAllAssignments, listAllClasses } from "@/lib/admin";
import { formatDateTime } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { AssignmentStatus } from "@/types/api";

const COLUMNS = 5;

// Read-only by design. An admin can see every teacher's work, including drafts — this is the only
// endpoint in the API that returns those — but editing someone else's assignment is a teacher-scoped
// action under rule 4, and the API would refuse it. A page with Edit buttons that always 403 would be
// worse than no buttons.
export default function AdminAssignmentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [classId, setClassId] = useState("");

  const loader = useCallback(
    (signal: AbortSignal) =>
      listAllAssignments(
        {
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          status: status || undefined,
          classId: classId || undefined,
          sortBy: "deadline",
          sortDir: "desc",
        },
        signal,
      ),
    [page, status, classId],
  );

  const { data, error, loading } = useAsync(loader);

  // For the class filter. Loaded once — the option list does not depend on the current page.
  const classesLoader = useCallback((signal: AbortSignal) => listAllClasses(signal), []);
  const { data: classes } = useAsync(classesLoader);

  return (
    <>
      <PageHeader
        title="All assignments"
        subtitle="Every assignment in the system, from every teacher — drafts included."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-56">
          <Select
            label="Filter by status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Published", label: "Published" },
            ]}
            onChange={(event) => {
              setStatus(event.target.value as AssignmentStatus | "");
              setPage(1);
            }}
          />
        </div>

        <div className="w-56">
          <Select
            label="Filter by class"
            value={classId}
            options={[
              { value: "", label: "All classes" },
              ...(classes?.items ?? []).map((item) => ({
                value: item.id,
                label: `${item.code} — ${item.name}`,
              })),
            ]}
            onChange={(event) => {
              setClassId(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title="No assignments match"
          description={
            status || classId
              ? "Try clearing the filters."
              : "No teacher has created an assignment yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Class / Subject</TH>
                <TH>Status</TH>
                <TH>Deadline</TH>
                <TH align="right">Max marks</TH>
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

                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <AssignmentStatusBadge status={assignment.status} />
                        {/* A draft's deadline has nothing to be late for. */}
                        {assignment.status === "Published" && (
                          <OverdueBadge isOverdue={assignment.isOverdue} />
                        )}
                        {assignment.allowLateSubmission && <Badge tone="info">Late allowed</Badge>}
                      </div>
                    </TD>

                    <TD className="whitespace-nowrap">{formatDateTime(assignment.deadline)}</TD>

                    <TD align="right" className="tabular-nums">
                      {assignment.maxMarks}
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
