"use client";

import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { StatCard } from "@/components/ui/StatCard";
import { useAsync } from "@/hooks/useAsync";
import { loadAdminStats } from "@/lib/dashboard";

// loadAdminStats is passed by reference, not wrapped in an arrow — useAsync puts the loader in its
// dependency array, so an inline closure would re-run the effect on every render.
export default function AdminDashboardPage() {
  const { data, error, loading } = useAsync(loadAdminStats);

  return (
    <>
      <WelcomeHeader subtitle="System-wide overview of users, classes and activity." />

      {error && <Alert className="mb-4">{error}</Alert>}

      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </>
  );
}
