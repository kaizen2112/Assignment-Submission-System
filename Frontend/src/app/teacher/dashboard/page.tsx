"use client";

import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { StatCard } from "@/components/ui/StatCard";
import { useAsync } from "@/hooks/useAsync";
import { loadTeacherStats } from "@/lib/dashboard";

export default function TeacherDashboardPage() {
  const { data, error, loading } = useAsync(loadTeacherStats);

  return (
    <>
      <WelcomeHeader subtitle="Your assignments and the submissions waiting on you." />

      {error && <Alert className="mb-4">{error}</Alert>}

      {/* Only shown when a page was actually truncated, so it is a real caveat rather than permanent
          small print. See the N+1 note in lib/dashboard.ts. */}
      {data?.approximate && (
        <Alert tone="warning" className="mb-4">
          You have more assignments or submissions than fit in one page, so “awaiting grading” is a
          minimum, not an exact count.
        </Alert>
      )}

      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting grading"
          value={data?.awaitingGrading ?? null}
          loading={loading}
          hint="Submitted or late, not yet graded"
          emphasis
        />
        <StatCard label="My assignments" value={data?.assignments ?? null} loading={loading} />
        <StatCard
          label="Published"
          value={data?.published ?? null}
          loading={loading}
          hint="Visible to students"
        />
        <StatCard
          label="Drafts"
          value={data?.drafts ?? null}
          loading={loading}
          hint="Hidden from students"
        />
      </section>
    </>
  );
}
