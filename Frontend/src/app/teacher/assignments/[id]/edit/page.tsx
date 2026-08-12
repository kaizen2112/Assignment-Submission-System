"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Save, Upload } from "lucide-react";
import { AssignmentFields } from "@/components/teacher/AssignmentFields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AssignmentStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CARD_CLASS, FormActions, FormCard } from "@/components/ui/Card";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { getAssignment, publishAssignment, updateAssignment } from "@/lib/assignments";
import { assignmentSchema } from "@/lib/schemas";
import type { AssignmentValues } from "@/lib/schemas";
import { cn, dateTimeLocalToUtcIso, utcIsoToDateTimeLocal } from "@/lib/utils";

export default function EditAssignmentPage() {
  const router = useRouter();
  // useParams rather than a page prop: this is a client component, and Next 16's page props deliver
  // params as a Promise that a client component cannot await during render.
  const { id } = useParams<{ id: string }>();

  // Set by the duplicate action on the assignments list. The message belongs here rather than in a toast on
  // the page that fired it: a toast racing a navigation either unmounts mid-flight or expires while the
  // teacher is still reading the form, and what it has to say — "set the deadline before publishing" — is
  // about *this* screen. Shown on the page where the work gets done, it survives as long as it is relevant.
  const justDuplicated = useSearchParams().get("duplicated") === "1";

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
        <SkeletonRegion label="Loading assignment" className="max-w-2xl space-y-6">
          <div className={cn(CARD_CLASS, "p-6")}>
            <Skeleton className="mb-5 h-3 w-32" />
            <Skeleton className="mb-4 h-10 w-full rounded-lg" />
            <Skeleton className="mb-4 h-32 w-full rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </SkeletonRegion>
      </>
    );
  }

  // A 404 here is also what a teacher gets for another teacher's assignment — the API does not
  // distinguish, deliberately (assumption A7), so neither does this message.
  if (loadError || !assignment) {
    return (
      <>
        <PageHeader title="Edit assignment" backHref="/teacher/assignments" backLabel="Assignments" />
        <Alert className="mb-6">{loadError ?? "This assignment could not be loaded."}</Alert>
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
        crumbs={[
          { label: "Assignments", href: "/teacher/assignments" },
          { label: assignment.title },
        ]}
        action={<AssignmentStatusBadge status={assignment.status} />}
      />

      {formError && <Alert className="mb-6">{formError}</Alert>}

      {/* First, because it explains why the teacher is on this page at all. */}
      {justDuplicated && (
        <Alert tone="success" className="mb-6">
          Assignment duplicated — update the deadline before publishing. The copy is a draft with a
          placeholder deadline one week from now, so students cannot see it yet.
        </Alert>
      )}

      {/* Editing a published assignment changes what students already see, which is worth saying out
          loud. It is allowed — the API permits it — but it should not be a surprise. */}
      {assignment.status === "Published" && (
        <Alert tone="info" className="mb-6">
          This assignment is published. Changes take effect for students immediately.
        </Alert>
      )}

      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex max-w-2xl flex-col gap-6"
        >
          <FormCard label="Assignment details">
            {/* Class and subject are fixed for the life of the assignment, so they are shown, not
                edited. A padlock says "cannot" more immediately than a sentence does. */}
            <p className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
              <Lock aria-hidden="true" className="size-3.5 shrink-0" />
              {assignment.className} · {assignment.subjectName} — cannot be changed after creation.
            </p>

            <AssignmentFields />
          </FormCard>

          <FormActions>
            <Button type="submit" icon={<Save />} loading={isSubmitting}>
              Save changes
            </Button>

            {assignment.status === "Draft" && (
              <Button
                type="button"
                variant="secondary"
                icon={<Upload />}
                loading={publishing}
                onClick={handlePublish}
              >
                Publish
              </Button>
            )}

            <Link href="/teacher/assignments">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </FormActions>
        </form>
      </FormProvider>
    </>
  );
}
