"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Copy, Pencil, Plus, Send, Trash2, Upload } from "lucide-react";
import { CompletionText } from "@/components/teacher/Completion";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeadlineLabel } from "@/components/ui/DeadlineLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionButton, ActionLink, RowActionBar } from "@/components/ui/RowActionBar";
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
import {
  deleteAssignment,
  duplicateAssignment,
  listAssignments,
  publishAssignment,
} from "@/lib/assignments";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { AssignmentStatus } from "@/types/api";

const COLUMNS = 6;

export default function TeacherAssignmentsPage() {
  const router = useRouter();
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
  // Class and subject come from the URL, set by the sidebar's class tree. In the query string rather than in
  // component state so the filtered view is shareable, survives a reload and gets the back button for free.
  // The API already accepts both — this only forwards them.
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId") ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;

  const loader = useCallback(
    (signal: AbortSignal) =>
      listAssignments(
        {
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          status: status || undefined,
          classId,
          subjectId,
          sortBy: "deadline",
          sortDir: "asc",
        },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [page, status, classId, subjectId, reloadKey],
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

  // Straight to the copy's edit form on success. The copy carries a placeholder deadline a week out, so
  // landing anywhere else would leave a teacher with a draft they have to remember to go and fix — the
  // ?duplicated=1 flag is what tells that page to say so.
  //
  // No setReloadKey: this navigates away, so refetching the list the teacher is leaving would be work
  // nobody sees. Failures stay on the list and surface in the existing actionError banner.
  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    setActionError(null);

    try {
      const copy = await duplicateAssignment(id);
      router.push(`/teacher/assignments/${copy.id}/edit?duplicated=1`);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "That assignment could not be duplicated.",
      );
      setBusyId(null);
    }
    // No `finally`: on success the component is unmounting, and clearing busyId would be a state update on
    // a page already navigating away.
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

      {/* A filter arriving from the sidebar has to announce itself. Landing on a short list with no
          explanation reads as missing data, and the only clue would be a query string nobody looks at. The
          class and subject names come from the first row rather than a second request — if the filter matched
          nothing there is no name to show, and the empty state below carries the message instead. */}
      {(classId || subjectId) && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Filtered to</span>
          <Badge tone="accent">
            {data?.items[0]
              ? `${data.items[0].className} · ${data.items[0].subjectName}`
              : "one class and subject"}
          </Badge>
          <Link
            href="/teacher/assignments"
            className="font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Clear
          </Link>
        </div>
      )}

      {error && <Alert className="mb-6">{error}</Alert>}
      {actionError && <Alert className="mb-6">{actionError}</Alert>}

      {/* An empty result is a 200, not an error — so it gets its own state, not the error banner. */}
      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={
            classId || subjectId
              ? "Nothing for this class and subject"
              : status
                ? `No ${status.toLowerCase()} assignments`
                : "No assignments yet"
          }
          description={
            classId || subjectId
              ? "You have not created anything for this class and subject yet. Clear the filter to see everything."
              : status
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
                <TH>Submitted</TH>
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

                      {/* Class name promoted, subject demoted. Both were mid-gray before, so the pair read
                          as one two-line blob; now the class is the line you scan and the subject qualifies
                          it. */}
                      <TD>
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {assignment.className}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {assignment.subjectName}
                        </span>
                      </TD>

                      <TD>
                        <div className="flex flex-wrap items-center gap-1">
                          <AssignmentStatusBadge status={assignment.status} />
                          {assignment.allowLateSubmission && <Badge tone="info">Late OK</Badge>}
                        </div>
                      </TD>

                      {/* A draft has no submissions and cannot have any (rule 6), so it reports nothing
                          rather than an honest-looking 0 / 18 that would read as a class ignoring it. */}
                      <TD>
                        {assignment.status === "Draft" ? (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        ) : (
                          <CompletionText stats={assignment.completion} />
                        )}
                      </TD>

                      <TD>
                        <DeadlineLabel deadline={assignment.deadline} />
                      </TD>

                      <TD align="right">
                        {/* Labelled, not icon-only. A row here carries four or five actions, and a strip of
                            bare glyphs makes "which one duplicates and which one publishes?" a memory test.
                            The 2x2 grid and its border live in RowActionBar, which also records why the
                            panel is fully visible at rest rather than appearing on hover. */}
                        {/* Four fixed slots, in the same order on every row. Publish used to sit third
                            and the submissions link first, so a draft and a published row disagreed
                            about which cell held Edit and which held Duplicate — scanning down the
                            column meant re-reading each panel. Only the top-left slot varies now, and
                            it varies with exactly the thing that should change it: the status. Edit,
                            Duplicate and Delete never move.

                            The two candidates for that slot are also each row's most likely action, so
                            the accent tone lands in the same corner throughout. */}
                        <RowActionBar>
                          {assignment.status === "Published" ? (
                            /* Drafts have no submissions to review, so the link would always be empty. */
                            <ActionLink
                              href={`/teacher/assignments/${assignment.id}/submissions`}
                              // "Submissions", not "View submissions": in a column headed ACTIONS, beside
                              // a send icon, the verb carries no information — and it was the widest label
                              // in the panel, so dropping it is what lets the whole column be narrower.
                              label="Submissions"
                              icon={<Send />}
                              tone="accent"
                            />
                          ) : (
                            /* Not in the brief's list of four, and kept anyway: publishing is how a draft
                               reaches students at all, and dropping the control would have removed the
                               feature rather than relabelled it. */
                            <ActionButton
                              label="Publish"
                              icon={<Upload />}
                              tone="accent"
                              loading={isBusy}
                              onClick={() =>
                                void runAction(assignment.id, () => publishAssignment(assignment.id))
                              }
                            />
                          )}

                          <ActionLink
                            href={`/teacher/assignments/${assignment.id}/edit`}
                            label="Edit"
                            icon={<Pencil />}
                          />

                          {/* Available on drafts as well as published work: reusing last term's brief is
                              the whole point, and its status is irrelevant to whether it makes a good
                              starting point. */}
                          <ActionButton
                            label="Duplicate"
                            icon={<Copy />}
                            loading={isBusy}
                            onClick={() => void handleDuplicate(assignment.id)}
                          />

                          <ActionButton
                            label="Delete"
                            icon={<Trash2 />}
                            tone="danger"
                            loading={isBusy}
                            onClick={() => handleDelete(assignment.id, assignment.title)}
                          />
                        </RowActionBar>
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
