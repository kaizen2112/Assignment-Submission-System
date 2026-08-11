"use client";

import Link from "next/link";
import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { StatCard } from "@/components/ui/StatCard";
import { useAsync } from "@/hooks/useAsync";
import { loadAdminStats } from "@/lib/dashboard";

// The order a school actually gets set up in, which is also the order the business rules depend on: a
// class before a subject, a subject before a teacher grant, a teacher grant before an assignment.
const SETUP_STEPS = [
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
];

// loadAdminStats is passed by reference, not wrapped in an arrow — useAsync puts the loader in its
// dependency array, so an inline closure would re-run the effect on every render.
export default function AdminDashboardPage() {
  const { data, error, loading } = useAsync(loadAdminStats);

  return (
    <>
      <WelcomeHeader subtitle="System-wide overview of users, classes and activity." />

      {error && <Alert className="mb-4">{error}</Alert>}

      <section
        aria-label="Statistics"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard label="Users" value={data?.users ?? null} loading={loading} emphasis />
        <StatCard label="Teachers" value={data?.teachers ?? null} loading={loading} />
        <StatCard label="Students" value={data?.students ?? null} loading={loading} />
        <StatCard label="Classes" value={data?.classes ?? null} loading={loading} />
        <StatCard
          label="Assignments"
          value={data?.assignments ?? null}
          loading={loading}
          hint="Includes every teacher's drafts"
        />
        <StatCard label="Submissions" value={data?.submissions ?? null} loading={loading} />
      </section>

      {/* Worth the space on an otherwise stat-only page: the dependency order between classes, accounts
          and grants is the one thing a first-time admin cannot guess, and getting it wrong produces
          confusing 400s and 403s much later. */}
      <Section
        title="Setting up"
        description="Every administrative task lives in the sidebar. Nothing here needs Swagger."
      >
        <ol className="flex flex-col gap-3">
          {SETUP_STEPS.map((step) => (
            <li
              key={step.title}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-sm text-slate-500">{step.body}</p>
              </div>

              <Link href={step.href}>
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
