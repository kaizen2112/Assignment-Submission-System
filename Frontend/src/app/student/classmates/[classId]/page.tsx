"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
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
import { listClassmates } from "@/lib/classes";

const COLUMNS = 2;

// Who else is in this class. Names and emails only — no marks, no submission counts, nothing about how
// anybody is doing. That is not a UI omission: the endpoint does not send it, so there is nothing here to
// leak even by accident.
//
// The class id comes from the route rather than from the student's profile, because the schema allows a
// student in several classes and the seed data has one. The API answers 404 for any class the caller is not
// enrolled in, so a hand-edited URL gets the same page as a typo.
export default function ClassmatesPage() {
  const { classId } = useParams<{ classId: string }>();
  const [page, setPage] = useState(1);

  const loader = useCallback(
    (signal: AbortSignal) => listClassmates(classId, page, signal),
    [classId, page],
  );

  const { data, error, loading } = useAsync(loader);

  return (
    <>
      <PageHeader
        title="Classmates"
        subtitle="Everyone enrolled in this class."
        backHref="/student/dashboard"
        backLabel="Dashboard"
        crumbs={[{ label: "Student" }, { label: "Classmates" }]}
      />

      {/* A 404 here means "not your class", which the API deliberately does not distinguish from "no such
          class" (A7) — so neither does this message. */}
      {error && <Alert className="mb-6">{error}</Alert>}

      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Nobody else yet"
          description="You are the only student enrolled in this class so far."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TableWrap>
            <THead>
              <TR hover={false}>
                <TH>Student</TH>
                <TH>Email</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} />
            ) : (
              <TBody>
                {data?.items.map((classmate) => (
                  <TR key={classmate.id}>
                    <TDPrimary>
                      <span className="flex items-center gap-3">
                        <Avatar fullName={classmate.fullName} size="sm" />
                        <span className="min-w-0">{classmate.fullName}</span>
                        {/* Flagged rather than filtered out server-side — a roster with a gap where you
                            should be reads as a bug, and the count then disagrees with the class size. */}
                        {classmate.isYou && <Badge tone="accent">You</Badge>}
                      </span>
                    </TDPrimary>

                    <TD className="text-xs text-gray-500 dark:text-gray-400">{classmate.email}</TD>
                  </TR>
                ))}
              </TBody>
            )}
          </TableWrap>

          {data && <Pagination result={data} onPageChange={setPage} disabled={loading} />}
        </div>
      )}
    </>
  );
}
