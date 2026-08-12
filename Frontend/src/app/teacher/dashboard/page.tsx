"use client";

import Link from "next/link";
import { ClipboardList, FileClock, FileEdit, Plus, Send } from "lucide-react";
import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge, LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeadlineLabel } from "@/components/ui/DeadlineLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { StatCard } from "@/components/ui/StatCard";
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
import { loadTeacherStats } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/utils";

export default function TeacherDashboardPage() {
  const { data, error, loading } = useAsync(loadTeacherStats);

  return (
    <>
      <WelcomeHeader
        subtitle="Your assignments and the submissions waiting on you."
        action={
          <Link href="/teacher/assignments/new">
            <Button icon={<Plus />}>New assignment</Button>
          </Link>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {/* Only shown when a page was actually truncated, so it is a real caveat rather than permanent
          small print. See the N+1 note in lib/dashboard.ts. */}
      {data?.approximate && (
        <Alert tone="warning" className="mb-6">
          You have more assignments or submissions than fit in one page, so “awaiting grading” is a
          minimum, not an exact count.
        </Alert>
      )}

      {/* Three cards, not four: awaiting-grading is the number a teacher opens this page for, and the
          draft/published split is one fact rather than two. */}
      <section aria-label="Statistics" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Awaiting grading"
          value={data?.awaitingGrading ?? null}
          icon={<FileClock />}
          tone="amber"
          hint="Submitted or late, not yet graded"
          loading={loading}
        />
        <StatCard
          label="My assignments"
          value={data?.assignments ?? null}
          icon={<ClipboardList />}
          tone="accent"
          hint={
            data ? `${data.published} published · ${data.drafts} draft` : "Across every class you teach"
          }
          loading={loading}
        />
        <StatCard
          label="Drafts"
          value={data?.drafts ?? null}
          icon={<FileEdit />}
          tone="gray"
          hint="Hidden from students"
          loading={loading}
        />
      </section>

      {/* Side by side on wide screens, stacked below xl. Two tables at 600px each is unreadable, so the
          breakpoint is deliberately late. */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Recent assignments"
          icon={<ClipboardList />}
          description="Your five newest, drafts included."
          bodyClassName="px-0 pb-0"
          action={
            <Link
              href="/teacher/assignments"
              className="text-sm font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View all
            </Link>
          }
        >
          {loading ? (
            <TableWrap bare>
              <TableSkeleton columns={3} rows={4} />
            </TableWrap>
          ) : data && data.recentAssignments.length === 0 ? (
            <EmptyState
              bare
              icon={<ClipboardList />}
              title="No assignments yet"
              description="Create your first one. It starts as a draft, so students see nothing until you publish."
              action={
                <Link href="/teacher/assignments/new">
                  <Button icon={<Plus />}>New assignment</Button>
                </Link>
              }
            />
          ) : (
            <TableWrap bare>
              <THead>
                <TR hover={false}>
                  <TH>Title</TH>
                  <TH>Status</TH>
                  <TH>Deadline</TH>
                </TR>
              </THead>
              <TBody>
                {data?.recentAssignments.map((assignment) => (
                  <TR key={assignment.id}>
                    <TDPrimary>
                      <Link
                        href={`/teacher/assignments/${assignment.id}/edit`}
                        className="transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {assignment.title}
                      </Link>
                      <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">
                        {assignment.className} · {assignment.subjectName}
                      </span>
                    </TDPrimary>

                    <TD>
                      <AssignmentStatusBadge status={assignment.status} />
                    </TD>

                    <TD>
                      <DeadlineLabel deadline={assignment.deadline} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          )}
        </Section>

        <Section
          title="Pending submissions"
          icon={<Send />}
          description="Newest first. Click through to grade."
          bodyClassName="px-0 pb-0"
        >
          {loading ? (
            <TableWrap bare>
              <TableSkeleton columns={3} rows={4} />
            </TableWrap>
          ) : data && data.pending.length === 0 ? (
            <EmptyState
              bare
              icon={<Send />}
              title={
                data.awaitingGrading === null
                  ? "Could not load submissions"
                  : "Nothing waiting on you"
              }
              description={
                data.awaitingGrading === null
                  ? "The submission counts could not be loaded. Your assignments are still listed."
                  : "Every submission on your published assignments has been graded."
              }
            />
          ) : (
            <TableWrap bare>
              <THead>
                <TR hover={false}>
                  <TH>Student</TH>
                  <TH>Assignment</TH>
                  <TH>Submitted</TH>
                </TR>
              </THead>
              <TBody>
                {data?.pending.map(({ submission, assignmentId }) => (
                  <TR key={submission.id}>
                    <TDPrimary>
                      <Link
                        href={`/teacher/assignments/${assignmentId}/submissions/${submission.id}`}
                        className="transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {submission.studentName}
                      </Link>
                      <span className="mt-1 flex items-center gap-1">
                        <SubmissionStatusBadge status={submission.status} />
                        <LateBadge isLate={submission.isLate} />
                      </span>
                    </TDPrimary>

                    <TD>{submission.assignmentTitle}</TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(submission.submittedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          )}
        </Section>
      </div>
    </>
  );
}
