"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge, OverdueBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { deleteAssignment, listAssignments, publishAssignment } from "@/lib/assignments";
import { formatDateTime } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { AssignmentStatus } from "@/types/api";

const COLUMNS = 6;

export default function TeacherAssignmentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AssignmentStatus | "">("");

  // Bumped after a publish or delete to force a refetch. Cheaper and less error-prone than splicing the
  // mutated row into local state, which would then disagree with the server's totalCount and paging.
  const [reloadKey, setReloadKey] = useState(0);

  // Per-row busy id, so publishing one assignment does not disable every button in the table.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // useCallback with page/status/reloadKey in the deps is what drives refetching — useAsync re-runs
  // whenever this identity changes. An inline arrow here would refetch forever.
  const loader = useCallback(
    (signal: AbortSignal) =>
      listAssignments(
        { page, pageSize: DEFAULT_PAGE_SIZE, status: status || undefined, sortBy: "deadline", sortDir: "asc" },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [page, status, reloadKey],
  );

  const { data, error, loading } = useAsync(loader);

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);

    try {
      await action();
      setReloadKey((key) => key + 1);
    } catch (caught) {
      // A 409 here is the expected refusal to delete an assignment that has submissions (A5), and its
      // detail is a sentence written for the teacher — so it is shown as-is rather than replaced.
      setActionError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (id: string, title: string) => {
    // A native confirm rather than a modal component: deletion is irreversible and this is the one
    // interaction where the browser's own blocking dialog is an advantage, not a compromise.
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;

    void runAction(id, () => deleteAssignment(id));
  };

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Everything you have created, across every class you teach."
        action={
          <Link href="/teacher/assignments/new">
            <Button>New assignment</Button>
          </Link>
        }
      />

      <div className="mb-4 max-w-56">
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
            // Back to page 1: staying on page 3 of a filter that now has one page shows an empty table.
            setPage(1);
          }}
        />
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}
      {actionError && <Alert className="mb-4">{actionError}</Alert>}

      {/* An empty result is a 200, not an error — so it gets its own state, not the error banner. */}
      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title={status ? `No ${status.toLowerCase()} assignments` : "No assignments yet"}
          description={
            status
              ? "Try clearing the status filter to see everything you have created."
              : "Create your first assignment. It starts as a draft, so students will not see it until you publish."
          }
          action={
            <Link href="/teacher/assignments/new">
              <Button>New assignment</Button>
            </Link>
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
                <TH align="right">Actions</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((assignment) => {
                  const isBusy = busyId === assignment.id;

                  return (
                    <TR key={assignment.id}>
                      <TD className="font-medium text-slate-900">{assignment.title}</TD>

                      <TD>
                        <span className="block">{assignment.className}</span>
                        <span className="block text-xs text-slate-500">{assignment.subjectName}</span>
                      </TD>

                      <TD>
                        <div className="flex flex-wrap items-center gap-1">
                          <AssignmentStatusBadge status={assignment.status} />
                          {/* Only meaningful once published — a draft's deadline has nothing to be late for. */}
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

                      <TD align="right">
                        {/* No flex-wrap: wrapping put Delete on its own line and made the column look
                            broken. TableWrap already scrolls horizontally, which is the better answer on
                            a narrow screen than a ragged stack of buttons. */}
                        <div className="flex justify-end gap-1.5 whitespace-nowrap">
                          {/* Drafts have no submissions to review, so the link would always be empty. */}
                          {assignment.status === "Published" && (
                            <Link href={`/teacher/assignments/${assignment.id}/submissions`}>
                              <Button size="sm" variant="secondary">
                                Submissions
                              </Button>
                            </Link>
                          )}

                          <Link href={`/teacher/assignments/${assignment.id}/edit`}>
                            <Button size="sm" variant="secondary">
                              Edit
                            </Button>
                          </Link>

                          {assignment.status === "Draft" && (
                            <Button
                              size="sm"
                              loading={isBusy}
                              onClick={() =>
                                void runAction(assignment.id, () => publishAssignment(assignment.id))
                              }
                            >
                              Publish
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="danger"
                            loading={isBusy}
                            onClick={() => handleDelete(assignment.id, assignment.title)}
                          >
                            Delete
                          </Button>
                        </div>
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
