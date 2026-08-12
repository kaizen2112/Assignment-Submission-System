"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Section, SectionFooter } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
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
import { ApiError } from "@/lib/api";
import { assignTeacher, listAllOfRole, listClassTeachers } from "@/lib/admin";
import { teacherAssignmentSchema } from "@/lib/schemas";
import type { TeacherAssignmentValues } from "@/lib/schemas";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import type { Subject } from "@/types/api";

const COLUMNS = 3;

// Each grant here is one row of the table rule 4 checks on every teacher mutation: a teacher may only
// touch the class+subject pairs listed for them. The roster below is the only place in the system that
// shows those rows, which is why the read endpoint behind it was added alongside these screens.
export function ClassTeachers({ classId, subjects }: { classId: string; subjects: Subject[] }) {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rosterLoader = useCallback(
    (signal: AbortSignal) =>
      listClassTeachers(classId, { page, pageSize: DEFAULT_PAGE_SIZE }, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [classId, page, reloadKey],
  );

  const { data: roster, error: rosterError, loading } = useAsync(rosterLoader);

  // Every teacher in the system, for the picker. Loaded once — the list does not depend on the class.
  const teachersLoader = useCallback((signal: AbortSignal) => listAllOfRole("Teacher", signal), []);
  const { data: teachers, error: teachersError } = useAsync(teachersLoader);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeacherAssignmentValues>({
    resolver: zodResolver(teacherAssignmentSchema),
    mode: "onBlur",
    defaultValues: { teacherId: "", subjectId: "" },
  });

  const onSubmit = async (values: TeacherAssignmentValues) => {
    setFormError(null);
    setSuccess(null);

    try {
      // classId comes from the route, not from a third dropdown: the subject options are already this
      // class's, and the API rejects a subject that belongs to a different class with a 400.
      const created = await assignTeacher({ ...values, classId });

      setSuccess(`${created.teacherName} now teaches ${created.subjectName} in ${created.className}.`);
      reset();
      setPage(1);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      // 409 for a duplicate grant, 400 if the chosen user is not a Teacher. Both sentences name the
      // person, so neither is worth rewording.
      setFormError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.",
      );
    }
  };

  const hasSubjects = subjects.length > 0;
  const hasTeachers = (teachers?.items.length ?? 0) > 0;

  return (
    <Section
      title="Teachers"
      icon={<Users />}
      description="Each row grants one teacher one subject in this class. Nothing else lets them create assignments here."
    >
      {rosterError && <Alert className="mb-4">{rosterError}</Alert>}
      {teachersError && <Alert className="mb-4">{teachersError}</Alert>}
      {formError && <Alert className="mb-4">{formError}</Alert>}
      {success && (
        <Alert tone="success" className="mb-4">
          {success}
        </Alert>
      )}

      {/* A class nobody teaches yet is a 200 with an empty list, not an error — so it gets a sentence
          rather than a table with one apologetic row in it. */}
      {!loading && !rosterError && roster?.items.length === 0 ? (
        <p className="text-sm text-gray-500">No teachers assigned to this class yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <TableWrap>
            <THead>
              <TR hover={false}>
                <TH>Teacher</TH>
                <TH>Subject</TH>
                <TH>Assigned</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} rows={2} />
            ) : (
              <TBody>
                {roster?.items.map((row) => (
                  <TR key={row.id}>
                    <TDPrimary>{row.teacherName}</TDPrimary>
                    <TD>{row.subjectName}</TD>
                    <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(row.assignedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            )}
          </TableWrap>

          {roster && <Pagination result={roster} onPageChange={setPage} disabled={loading} />}
        </div>
      )}

      <SectionFooter>
        {!hasSubjects ? (
          <p className="text-sm text-gray-500">Add a subject above before assigning a teacher.</p>
        ) : !hasTeachers ? (
          <p className="text-sm text-gray-500">
            There are no teacher accounts yet. Create one under Users first.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-wrap items-start gap-3"
          >
            <div className="w-full sm:w-64">
              <Select
                label="Teacher"
                required
                placeholder="Choose a teacher"
                options={(teachers?.items ?? []).map((teacher) => ({
                  value: teacher.id,
                  label: `${teacher.fullName} (${teacher.email})`,
                }))}
                error={errors.teacherId?.message}
                {...register("teacherId")}
              />
            </div>

            <div className="w-full sm:w-56">
              <Select
                label="Subject"
                required
                placeholder="Choose a subject"
                options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
                error={errors.subjectId?.message}
                {...register("subjectId")}
              />
            </div>

            <Button type="submit" icon={<Plus />} className="sm:mt-7" loading={isSubmitting}>
              Assign teacher
            </Button>
          </form>
        )}
      </SectionFooter>
    </Section>
  );
}
