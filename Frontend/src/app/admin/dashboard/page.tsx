"use client";

import Link from "next/link";
import {
  Activity,
  BookOpen,
  ClipboardList,
  Layers,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
import { loadAdminStats } from "@/lib/dashboard";
import { formatDateTime, formatMarks } from "@/lib/utils";

// The order a school actually gets set up in, which is also the order the business rules depend on: a
// class before a subject, a subject before a teacher grant, a teacher grant before an assignment.
const QUICK_ACTIONS = [
  { href: "/admin/users/new", label: "Add user", icon: <UserPlus /> },
  { href: "/admin/classes", label: "Add class", icon: <Plus /> },
  { href: "/admin/classes", label: "Assign teacher", icon: <Users /> },
];

// loadAdminStats is passed by reference, not wrapped in an arrow — useAsync puts the loader in its
// dependency array, so an inline closure would re-run the effect on every render.
export default function AdminDashboardPage() {
  const { data, error, loading } = useAsync(loadAdminStats);

  return (
    <>
      <WelcomeHeader subtitle="System-wide overview of users, classes and activity." />

      {error && <Alert className="mb-6">{error}</Alert>}

      <section aria-label="Statistics" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={data?.users ?? null}
          icon={<Users />}
          tone="accent"
          hint={data ? `${data.teachers} teachers · ${data.students} students` : undefined}
          loading={loading}
        />
        <StatCard
          label="Classes"
          value={data?.classes ?? null}
          icon={<Layers />}
          tone="blue"
          loading={loading}
        />
        <StatCard
          label="Subjects"
          value={data?.subjects ?? null}
          icon={<BookOpen />}
          tone="green"
          hint="Across all classes"
          loading={loading}
        />
        <StatCard
          label="Assignments"
          value={data?.assignments ?? null}
          icon={<ClipboardList />}
          tone="amber"
          hint="Includes every teacher's drafts"
          loading={loading}
        />
      </section>

      {/* Outlined, not filled. Three primary-coloured buttons in a row would each claim to be the main
          action; these are shortcuts, and the dependency order below is the real guidance. */}
      <section aria-label="Quick actions" className="mb-8 flex flex-wrap gap-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.label} href={action.href}>
            <Button variant="secondary" icon={action.icon}>
              {action.label}
            </Button>
          </Link>
        ))}
      </section>

      <Section
        title="Recent activity"
        icon={<Activity />}
        description="The newest submissions across every class."
        bodyClassName="px-0 pb-0"
        action={
          <Link
            href="/admin/submissions"
            className="text-sm font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-700"
          >
            View all
          </Link>
        }
      >
        {loading ? (
          <TableWrap bare>
            <TableSkeleton columns={4} rows={5} />
          </TableWrap>
        ) : data && data.recentSubmissions.length === 0 ? (
          <EmptyState
            bare
            icon={<Activity />}
            title="No activity yet"
            description="Submissions appear here once students start handing work in against published assignments."
          />
        ) : (
          <TableWrap bare>
            <THead>
              <TR hover={false}>
                <TH>Student</TH>
                <TH>Assignment</TH>
                <TH>Submitted</TH>
                <TH align="right">Marks</TH>
              </TR>
            </THead>
            <TBody>
              {data?.recentSubmissions.map((submission) => (
                <TR key={submission.id}>
                  <TDPrimary>
                    {submission.studentName}
                    <span className="mt-1 flex items-center gap-1">
                      <SubmissionStatusBadge status={submission.status} />
                      <LateBadge isLate={submission.isLate} />
                    </span>
                  </TDPrimary>

                  <TD>{submission.assignmentTitle}</TD>

                  <TD className="whitespace-nowrap text-xs text-gray-500">
                    {formatDateTime(submission.submittedAt)}
                  </TD>

                  <TD align="right" className="tabular-nums">
                    {formatMarks(submission.marks, submission.maxMarks)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
        )}
      </Section>

      {/* Worth the space on an otherwise stat-only page: the dependency order between classes, accounts
          and grants is the one thing a first-time admin cannot guess, and getting it wrong produces
          confusing 400s and 403s much later. */}
      <Section
        title="Setting up"
        description="Every administrative task lives in the sidebar. Nothing here needs Swagger."
        className="mt-6"
      >
        <ol className="flex flex-col gap-3">
          {[
            {
              href: "/admin/classes",
              title: "1. Create a class and its subjects",
              body: "Assignments belong to a class and a subject, so nothing else can be set up first.",
            },
            {
              href: "/admin/users",
              title: "2. Create teacher and student accounts",
              body: "The account works immediately, but grants nothing on its own.",
            },
            {
              href: "/admin/classes",
              title: "3. Assign teachers and enrol students",
              body: "A teacher needs a class+subject grant to create anything; a student needs an enrolment to see it.",
            },
          ].map((step, index) => (
            <li
              key={step.title}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3.5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{step.title.slice(3)}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{step.body}</p>
                </div>
              </div>

              <Link href={step.href} className="shrink-0">
                <Button size="sm" variant="secondary">
                  Go
                </Button>
              </Link>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
