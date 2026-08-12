"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, CircleDashed, GraduationCap, PartyPopper } from "lucide-react";
import { AssignmentCard } from "@/components/student/AssignmentCard";
import { WelcomeHeader } from "@/components/layout/WelcomeHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { useAsync } from "@/hooks/useAsync";
import { loadStudentStats } from "@/lib/dashboard";
import type { StudentAssignment } from "@/lib/dashboard";

// How many cards each section shows before deferring to the full list page. A dashboard is a summary.
const CARD_LIMIT = 6;

export default function StudentDashboardPage() {
  const { data, error, loading } = useAsync(loadStudentStats);

  // Split on submission state, not on the deadline: "what have I not handed in" is the only question a
  // student opens this page to answer. Already sorted by deadline ascending by the loader, so the most
  // urgent card is first without re-sorting here.
  const outstanding = (data?.items ?? []).filter((item) => item.submission === null);
  const completed = (data?.items ?? []).filter((item) => item.submission !== null);

  return (
    <>
      <WelcomeHeader
        subtitle="Assignments for your classes and where each one stands."
        action={
          <Link href="/student/assignments">
            <Button variant="secondary">All assignments</Button>
          </Link>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {data?.approximate && (
        <Alert tone="warning" className="mb-6">
          You have more assignments than fit in one page, so the counts and lists below cover only the
          first page.
        </Alert>
      )}

      <section aria-label="Statistics" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="To do"
          value={data?.pending ?? null}
          icon={<CircleDashed />}
          tone="amber"
          hint="Not yet submitted"
          loading={loading}
        />
        <StatCard
          label="Assignments"
          value={data?.available ?? null}
          icon={<BookOpen />}
          tone="accent"
          hint="Published, for your classes"
          loading={loading}
        />
        <StatCard
          label="Submitted"
          value={data?.submitted ?? null}
          icon={<CheckCircle2 />}
          tone="blue"
          loading={loading}
        />
        <StatCard
          label="Graded"
          value={data?.graded ?? null}
          icon={<GraduationCap />}
          tone="green"
          hint="Marks available"
          loading={loading}
        />
      </section>

      {/* --- To do ------------------------------------------------------------------------------- */}
      <section aria-labelledby="todo-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="todo-heading" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Needs your attention
          </h2>
          {outstanding.length > CARD_LIMIT && (
            <Link
              href="/student/assignments"
              className="text-sm font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View all {outstanding.length}
            </Link>
          )}
        </div>

        {loading ? (
          <SkeletonRegion label="Loading assignments" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </SkeletonRegion>
        ) : outstanding.length === 0 ? (
          <EmptyState
            icon={<PartyPopper />}
            title={completed.length > 0 ? "All caught up" : "Nothing to do yet"}
            description={
              completed.length > 0
                ? "You have submitted everything published for your classes."
                : "Nothing has been published for your classes. Check back later."
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {outstanding.slice(0, CARD_LIMIT).map((item: StudentAssignment) => (
              <AssignmentCard
                key={item.assignment.id}
                assignment={item.assignment}
                submission={item.submission}
              />
            ))}
          </div>
        )}
      </section>

      {/* --- Completed --------------------------------------------------------------------------- */}
      {!loading && completed.length > 0 && (
        <section aria-labelledby="completed-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="completed-heading" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Completed
            </h2>
            <Link
              href="/student/submissions"
              className="text-sm font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              My submissions
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {completed.slice(0, CARD_LIMIT).map((item: StudentAssignment) => (
              <AssignmentCard
                key={item.assignment.id}
                assignment={item.assignment}
                submission={item.submission}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
