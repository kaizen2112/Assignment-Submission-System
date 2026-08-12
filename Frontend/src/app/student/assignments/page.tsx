"use client";

import { useCallback, useState } from "react";
import { BookOpen } from "lucide-react";
import { AssignmentCard } from "@/components/student/AssignmentCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { CardSkeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { listAssignments } from "@/lib/assignments";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

export default function StudentAssignmentsPage() {
  const [page, setPage] = useState(1);

  // No status filter and no client-side scoping: GET /assignments is already scoped for a student by
  // AssignmentService — published only (rule 6), and only for classes they are enrolled in (rule 3).
  // Filtering here would be both redundant and untrustworthy.
  const loader = useCallback(
    (signal: AbortSignal) =>
      listAssignments(
        { page, pageSize: DEFAULT_PAGE_SIZE, sortBy: "deadline", sortDir: "asc" },
        signal,
      ),
    [page],
  );

  const { data, error, loading } = useAsync(loader);

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Everything published for your classes, soonest deadline first."
        crumbs={[{ label: "Student" }, { label: "Assignments" }]}
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {/* Cards, not a table. A student has a handful of assignments and a decision to make about each
          one; a table optimises for comparing many rows, which is the teacher's problem.

          This page does NOT fetch each assignment's submission state — that would be one request per
          card. The dashboard does it once and shows status chips there; here the deadline is the signal,
          and the status appears when you open one. */}
      {loading ? (
        <SkeletonRegion label="Loading assignments" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </SkeletonRegion>
      ) : !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No assignments yet"
          description="Nothing has been published for your classes. Check back later."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.items.map((assignment) => (
              // `submission` deliberately omitted, not passed as null: undefined means "not known", so
              // the card renders no status chip rather than labelling submitted work "Not submitted".
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>

          {data && <Pagination result={data} onPageChange={setPage} disabled={loading} />}
        </div>
      )}
    </>
  );
}
