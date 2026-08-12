"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ClipboardList, Pencil, Plus, Send, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeadlineLabel } from "@/components/ui/DeadlineLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton, IconLink, RowActions } from "@/components/ui/IconButton";
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
import { ApiError } from "@/lib/api";
import { deleteAssignment, listAssignments, publishAssignment } from "@/lib/assignments";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { AssignmentStatus } from "@/types/api";

const COLUMNS = 5;

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
        crumbs={[{ label: "Teacher" }, { label: "Assignments" }]}
        action={
          <Link href="/teacher/assignments/new">
            <Button icon={<Plus />}>New assignment</Button>
          </Link>
        }
      />

      <div className="mb-5 max-w-56">
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

      {error && <Alert className="mb-6">{error}</Alert>}
      {actionError && <Alert className="mb-6">{actionError}</Alert>}

      {/* An empty result is a 200, not an error — so it gets its own state, not the error banner. */}
      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={status ? `No ${status.toLowerCase()} assignments` : "No assignments yet"}
          description={
            status
              ? "Try clearing the status filter to see everything you have created."
              : "Create your first assignment. It starts as a draft, so students will not see it until you publish."
          }
          action={
            <Link href="/teacher/assignments/new">
              <Button icon={<Plus />}>New assignment</Button>
            </Link>
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
                <TH>Deadline</TH>
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
                      <TDPrimary>
                        <Link
                          href={`/teacher/assignments/${assignment.id}/edit`}
                          className="transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {assignment.title}
                        </Link>
                        <span className="block text-xs font-normal tabular-nums text-gray-400 dark:text-gray-500">
                          {assignment.maxMarks} marks
                        </span>
                      </TDPrimary>

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

                      <TD>
                        <DeadlineLabel deadline={assignment.deadline} />
                      </TD>

                      <TD align="right">
                        {/* Icon-only, revealed on row hover. Four text buttons per row turned this
                            table into a wall of words; see RowActions for why they stay visible to
                            keyboard and touch users. */}
                        <RowActions>
                          {/* Drafts have no submissions to review, so the link would always be empty. */}
                          {assignment.status === "Published" && (
                            <IconLink
                              href={`/teacher/assignments/${assignment.id}/submissions`}
                              label="View submissions"
                              icon={<Send />}
                            />
                          )}

                          <IconLink
                            href={`/teacher/assignments/${assignment.id}/edit`}
                            label="Edit assignment"
                            icon={<Pencil />}
                          />

                          {assignment.status === "Draft" && (
                            <IconButton
                              label="Publish assignment"
                              icon={<Upload />}
                              loading={isBusy}
                              onClick={() =>
                                void runAction(assignment.id, () => publishAssignment(assignment.id))
                              }
                            />
                          )}

                          <IconButton
                            label="Delete assignment"
                            icon={<Trash2 />}
                            tone="danger"
                            loading={isBusy}
                            onClick={() => handleDelete(assignment.id, assignment.title)}
                          />
                        </RowActions>
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
