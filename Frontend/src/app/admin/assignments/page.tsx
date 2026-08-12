"use client";

import { useCallback, useState } from "react";
import { ClipboardList } from "lucide-react";
import { CompletionText } from "@/components/teacher/Completion";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge } from "@/components/ui/Badge";
import { DeadlineLabel } from "@/components/ui/DeadlineLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
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
import { listAllAssignments, listAllClasses } from "@/lib/admin";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { AssignmentStatus } from "@/types/api";

const COLUMNS = 6;

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
        crumbs={[{ label: "Admin" }, { label: "All assignments" }]}
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="w-full sm:w-48">
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

        <div className="w-full sm:w-56">
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

      {error && <Alert className="mb-6">{error}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No assignments match"
          description={
            status || classId
              ? "Try clearing the filters."
              : "No teacher has created an assignment yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TableWrap>
            <THead>
              <TR hover={false}>
                <TH>Title</TH>
                <TH>Class / Subject</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
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
                    <TDPrimary>{assignment.title}</TDPrimary>

                    <TD>
                      <span className="block text-gray-700 dark:text-gray-300">{assignment.className}</span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500">{assignment.subjectName}</span>
                    </TD>

                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <AssignmentStatusBadge status={assignment.status} />
                        {assignment.allowLateSubmission && <Badge tone="info">Late OK</Badge>}
                      </div>
                    </TD>

                    {/* Oversight, so completion belongs here as much as on the teacher's own list — the API
                        sends it to an admin for the same reason. A draft reports nothing: it cannot have
                        submissions (rule 6), and "0 / 18" would read as a class ignoring it. */}
                    <TD>
                      {assignment.status === "Draft" ? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      ) : (
                        <CompletionText stats={assignment.completion} />
                      )}
                    </TD>

                    {/* DeadlineLabel already strikes the date through and says "Closed" once it has
                        passed, which is what the separate Overdue chip used to carry. */}
                    <TD>
                      <DeadlineLabel deadline={assignment.deadline} />
                    </TD>

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
