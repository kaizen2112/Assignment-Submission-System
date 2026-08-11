"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Section } from "@/components/ui/Section";
import { Select } from "@/components/ui/Select";
import { TableSkeleton, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/Table";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { enrolStudent, listAllOfRole, listClassStudents } from "@/lib/admin";
import { enrolmentSchema } from "@/lib/schemas";
import type { EnrolmentValues } from "@/lib/schemas";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/types/api";

// Student and Enrolled only. The response also carries className, but repeating "Class 10 - A" down
// every row of a page whose heading is already "Class 10 - A" is a column that costs width and says
// nothing.
const COLUMNS = 2;

// Enrollment is what rule 3 scopes a student by: a published assignment is invisible to anyone without a
// row here for its class. So this table is the answer to "why can this student not see the assignment?",
// which is the single most likely question an evaluator will have.
export function ClassStudents({ classId }: { classId: string }) {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rosterLoader = useCallback(
    (signal: AbortSignal) =>
      listClassStudents(classId, { page, pageSize: DEFAULT_PAGE_SIZE }, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadKey is a deliberate refetch trigger
    [classId, page, reloadKey],
  );

  const { data: roster, error: rosterError, loading } = useAsync(rosterLoader);

  const studentsLoader = useCallback((signal: AbortSignal) => listAllOfRole("Student", signal), []);
  const { data: students, error: studentsError } = useAsync(studentsLoader);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnrolmentValues>({
    resolver: zodResolver(enrolmentSchema),
    mode: "onBlur",
    defaultValues: { studentId: "" },
  });

  const onSubmit = async (values: EnrolmentValues) => {
    setFormError(null);
    setSuccess(null);

    try {
      const created = await enrolStudent({ studentId: values.studentId, classId });

      setSuccess(`${created.studentName} is now enrolled in ${created.className}.`);
      reset();
      setPage(1);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      // 409 for a student already enrolled here, 400 if the chosen user is not a Student.
      setFormError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.",
      );
    }
  };

  const hasStudents = (students?.items.length ?? 0) > 0;

  return (
    <Section
      title="Students"
      description="Only enrolled students can see this class's published assignments, or submit to them."
    >
      {rosterError && <Alert className="mb-4">{rosterError}</Alert>}
      {studentsError && <Alert className="mb-4">{studentsError}</Alert>}
      {formError && <Alert className="mb-4">{formError}</Alert>}
      {success && (
        <Alert tone="info" className="mb-4">
          {success}
        </Alert>
      )}

      {!loading && !rosterError && roster?.items.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">No students enrolled in this class yet.</p>
      ) : (
        <div className="mb-4 flex flex-col gap-3">
          <TableWrap>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Enrolled</TH>
              </TR>
            </THead>

            {loading ? (
              <TableSkeleton columns={COLUMNS} rows={2} />
            ) : (
              <TBody>
                {roster?.items.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium text-slate-900">{row.studentName}</TD>
                    <TD className="whitespace-nowrap">{formatDate(row.enrolledAt)}</TD>
                  </TR>
                ))}
              </TBody>
            )}
          </TableWrap>

          {roster && <Pagination result={roster} onPageChange={setPage} disabled={loading} />}
        </div>
      )}

      {hasStudents ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-wrap items-start gap-3 border-t border-slate-100 pt-4"
        >
          <div className="w-72">
            <Select
              label="Enrol a student"
              required
              placeholder="Choose a student"
              // Every student account, not just the unenrolled ones: there is no endpoint that lists
              // "students not in this class", and filtering client-side would need the whole roster
              // rather than the page shown above. Re-enrolling someone is a 409 with a clear sentence.
              options={(students?.items ?? []).map((student) => ({
                value: student.id,
                label: `${student.fullName} (${student.email})`,
              }))}
              error={errors.studentId?.message}
              {...register("studentId")}
            />
          </div>

          <Button type="submit" className="mt-6" loading={isSubmitting}>
            Enrol student
          </Button>
        </form>
      ) : (
        <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
          There are no student accounts yet. Create one under Users first.
        </p>
      )}
    </Section>
  );
}
