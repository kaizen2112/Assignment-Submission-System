"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssignmentFields } from "@/components/teacher/AssignmentFields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { getAssignment, publishAssignment, updateAssignment } from "@/lib/assignments";
import { assignmentSchema } from "@/lib/schemas";
import type { AssignmentValues } from "@/lib/schemas";
import { dateTimeLocalToUtcIso, utcIsoToDateTimeLocal } from "@/lib/utils";

export default function EditAssignmentPage() {
  const router = useRouter();
  // useParams rather than a page prop: this is a client component, and Next 16's page props deliver
  // params as a Promise that a client component cannot await during render.
  const { id } = useParams<{ id: string }>();

  const [formError, setFormError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const loader = useCallback((signal: AbortSignal) => getAssignment(id, signal), [id]);
  const { data: assignment, error: loadError, loading } = useAsync(loader);

  const methods = useForm<AssignmentValues>({
    resolver: zodResolver(assignmentSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      deadline: "",
      maxMarks: 100,
      allowLateSubmission: false,
    },
  });

  // No `errors` here: every field this form renders lives in AssignmentFields, which reads its own
  // errors from form context.
  const {
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = methods;

  // The form is created before the assignment arrives, so its values are filled in afterwards. reset()
  // rather than setValue per field: it also clears dirty/touched state, so the freshly loaded values are
  // treated as the baseline rather than as unsaved edits.
  useEffect(() => {
    if (!assignment) return;

    reset({
      title: assignment.title,
      description: assignment.description,
      deadline: utcIsoToDateTimeLocal(assignment.deadline),
      maxMarks: assignment.maxMarks,
      allowLateSubmission: assignment.allowLateSubmission,
    });
  }, [assignment, reset]);

  const onSubmit = async (values: AssignmentValues) => {
    setFormError(null);

    try {
      // No classId/subjectId: an assignment cannot move between classes, so the API's update shape
      // omits them entirely.
      await updateAssignment(id, {
        title: values.title,
        description: values.description,
        deadline: dateTimeLocalToUtcIso(values.deadline),
        maxMarks: values.maxMarks,
        allowLateSubmission: values.allowLateSubmission,
      });

      router.replace("/teacher/assignments");
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fields = ["title", "description", "deadline", "maxMarks"] as const;
        let matched = false;

        for (const field of fields) {
          const message = caught.fieldError(field);
          if (message) {
            setError(field, { message });
            matched = true;
          }
        }

        if (!matched) setFormError(caught.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setFormError(null);

    try {
      await publishAssignment(id);
      router.replace("/teacher/assignments");
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not publish this assignment.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Edit assignment" backHref="/teacher/assignments" backLabel="Assignments" />
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      </>
    );
  }

  // A 404 here is also what a teacher gets for another teacher's assignment — the API does not
  // distinguish, deliberately (assumption A7), so neither does this message.
  if (loadError || !assignment) {
    return (
      <>
        <PageHeader title="Edit assignment" backHref="/teacher/assignments" backLabel="Assignments" />
        <Alert className="mb-4">{loadError ?? "This assignment could not be loaded."}</Alert>
        <Link href="/teacher/assignments">
          <Button variant="secondary">Back to assignments</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Edit assignment"
        subtitle={`${assignment.className} — ${assignment.subjectName}`}
        backHref="/teacher/assignments"
        backLabel="Assignments"
        action={<AssignmentStatusBadge status={assignment.status} />}
      />

      {formError && <Alert className="mb-4">{formError}</Alert>}

      {/* Editing a published assignment changes what students already see, which is worth saying out
          loud. It is allowed — the API permits it — but it should not be a surprise. */}
      {assignment.status === "Published" && (
        <Alert tone="info" className="mb-4">
          This assignment is published. Changes take effect for students immediately.
        </Alert>
      )}

      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex max-w-2xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
        >
          {/* Class and subject are fixed for the life of the assignment, so they are shown, not edited. */}
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Class and subject cannot be changed after creation.
          </div>

          <AssignmentFields />

          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>

            {assignment.status === "Draft" && (
              <Button type="button" variant="secondary" loading={publishing} onClick={handlePublish}>
                Publish
              </Button>
            )}

            <Link href="/teacher/assignments">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </FormProvider>
    </>
  );
}
