"use client";

import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { StatCard } from "@/components/ui/StatCard";
import { useAsync } from "@/hooks/useAsync";
import { loadStudentStats } from "@/lib/dashboard";

export default function StudentDashboardPage() {
  const { data, error, loading } = useAsync(loadStudentStats);

  return (
    <>
      <WelcomeHeader subtitle="Assignments for your classes and where each one stands." />

      {error && <Alert className="mb-4">{error}</Alert>}

      {data?.approximate && (
        <Alert tone="warning" className="mb-4">
          You have more assignments than fit in one page, so the submission counts below cover only the
          first page.
        </Alert>
      )}

      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="To do"
          value={data?.pending ?? null}
          loading={loading}
          hint="Not yet submitted"
          emphasis
        />
        <StatCard
          label="Assignments"
          value={data?.available ?? null}
          loading={loading}
          hint="Published, for your classes"
        />
        <StatCard label="Submitted" value={data?.submitted ?? null} loading={loading} />
        <StatCard
          label="Graded"
          value={data?.graded ?? null}
          loading={loading}
          hint="Marks available"
        />
      </section>
    </>
  );
}
