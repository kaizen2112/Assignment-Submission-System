"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClassStudents } from "@/components/admin/ClassStudents";
import { ClassSubjects } from "@/components/admin/ClassSubjects";
import { ClassTeachers } from "@/components/admin/ClassTeachers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { findClass } from "@/lib/admin";

// The one screen where a class is actually set up: subjects, then the teachers who teach them, then the
// students enrolled. That order is the dependency order — a teacher grant needs a subject, and an
// assignment needs both a teacher grant and enrolled students to be visible to anyone.
export default function ManageClassPage() {
  const { id } = useParams<{ id: string }>();

  // Bumped after a subject is added, so the class refetches and the teacher picker sees the new subject
  // without a manual reload. The two roster sections own their own refresh — each one's table is next to
  // the form that changes it, so nothing else needs to know.
  const [reloadKey, setReloadKey] = useState(0);

  const loader = useCallback(
    (signal: AbortSignal) => findClass(id, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [id, reloadKey],
  );

  const { data: schoolClass, error, loading } = useAsync(loader);

  if (loading) {
    return (
      <>
        <PageHeader title="Manage class" backHref="/admin/classes" backLabel="Classes" />
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      </>
    );
  }

  if (error || !schoolClass) {
    return (
      <>
        <PageHeader title="Manage class" backHref="/admin/classes" backLabel="Classes" />
        <Alert className="mb-4">{error ?? "This class could not be found."}</Alert>
        <Link href="/admin/classes">
          <Button variant="secondary">Back to classes</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={schoolClass.name}
        subtitle="Set up subjects, assign teachers, and enrol students."
        backHref="/admin/classes"
        backLabel="Classes"
        action={<Badge tone="neutral">{schoolClass.code}</Badge>}
      />

      <div className="flex flex-col gap-5">
        <ClassSubjects
          classId={schoolClass.id}
          subjects={schoolClass.subjects}
          onChanged={() => setReloadKey((key) => key + 1)}
        />

        <ClassTeachers classId={schoolClass.id} subjects={schoolClass.subjects} />

        <ClassStudents classId={schoolClass.id} />
      </div>
    </>
  );
}
