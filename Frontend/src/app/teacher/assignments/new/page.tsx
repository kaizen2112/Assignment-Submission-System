"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssignmentFields } from "@/components/teacher/AssignmentFields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { createAssignment, getTeachingScope, publishAssignment } from "@/lib/assignments";
import { createAssignmentSchema } from "@/lib/schemas";
import type { CreateAssignmentValues } from "@/lib/schemas";
import { dateTimeLocalToUtcIso } from "@/lib/utils";
import type { TeachingScope } from "@/types/api";

// One picker of class+subject *pairs*, not two dropdowns. Rule 4 grants a pair, so independent selects
// could offer a combination the API then rejects with a 403 — the UI would be advertising something the
// backend forbids. The key round-trips through the form as a single string.
const scopeKey = (scope: TeachingScope) => `${scope.classId}|${scope.subjectId}`;

export default function NewAssignmentPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  // Set only in the awkward middle state: created, but the follow-up publish failed.
  const [savedAsDraftOnly, setSavedAsDraftOnly] = useState<string | null>(null);

  const { data: scope, error: scopeError, loading: scopeLoading } = useAsync(getTeachingScope);

  const methods = useForm<CreateAssignmentValues>({
    resolver: zodResolver(createAssignmentSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      deadline: "",
      // 100 rather than 0: 0 fails the MinMarks rule, so an untouched form would open already invalid.
      maxMarks: 100,
      allowLateSubmission: false,
      teachingScopeKey: "",
    },
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = methods;

  // Publishing is a second call: POST /assignments always creates a Draft (rule 6 cannot be bypassed at
  // creation), so "save and publish" is create-then-PATCH. If the publish half fails the assignment
  // still exists as a draft, which is why the message says so rather than implying nothing was saved.
  const submit = async (values: CreateAssignmentValues, publish: boolean) => {
    setFormError(null);

    const [classId, subjectId] = values.teachingScopeKey.split("|");

    if (!classId || !subjectId) {
      setError("teachingScopeKey", { message: "Choose a class and subject." });
      return;
    }

    try {
      const created = await createAssignment({
        title: values.title,
        description: values.description,
        deadline: dateTimeLocalToUtcIso(values.deadline),
        maxMarks: values.maxMarks,
        classId,
        subjectId,
        allowLateSubmission: values.allowLateSubmission,
      });

      if (publish) {
        try {
          await publishAssignment(created.id);
        } catch (publishFailure) {
          // The assignment now exists as a draft. Navigating away silently would leave the teacher
          // believing it published; letting them resubmit would create a duplicate. So the form retires
          // itself and says exactly where things stand.
          setSavedAsDraftOnly(
            publishFailure instanceof ApiError
              ? publishFailure.message
              : "The assignment was saved as a draft, but publishing failed.",
          );
          return;
        }
      }

      router.replace("/teacher/assignments");
    } catch (caught) {
      if (caught instanceof ApiError) {
        // Map the server's field errors onto the form where the field names line up, so a 400 lands next
        // to the offending input rather than in a banner at the top.
        const fields = ["title", "description", "deadline", "maxMarks"] as const;
        let matched = false;

        for (const field of fields) {
          const message = caught.fieldError(field);
          if (message) {
            setError(field, { message });
            matched = true;
          }
        }

        // A 403 from rule 4 has no field to attach to — the pair was revoked between load and submit.
        if (!matched) setFormError(caught.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  // Created, but not published. The form is deliberately gone: resubmitting would create a second copy.
  if (savedAsDraftOnly) {
    return (
      <>
        <PageHeader title="New assignment" backHref="/teacher/assignments" backLabel="Assignments" />
        <Alert tone="warning" className="mb-4">
          Your assignment was saved as a <strong>draft</strong>, but publishing it failed:{" "}
          {savedAsDraftOnly} You can publish it from the assignments list.
        </Alert>
        <Link href="/teacher/assignments">
          <Button>Go to assignments</Button>
        </Link>
      </>
    );
  }

  // A teacher assigned to nothing cannot create anything, and the API would answer any attempt with a
  // 403. Saying so is far better than rendering a form whose only picker is empty.
  if (!scopeLoading && !scopeError && scope?.items.length === 0) {
    return (
      <>
        <PageHeader title="New assignment" backHref="/teacher/assignments" backLabel="Assignments" />
        <EmptyState
          title="You are not assigned to any class yet"
          description="An administrator needs to assign you to a class and subject before you can create assignments."
          action={
            <Link href="/teacher/dashboard">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New assignment"
        subtitle="Saved as a draft. Students see nothing until you publish it."
        backHref="/teacher/assignments"
        backLabel="Assignments"
      />

      {scopeError && <Alert className="mb-4">{scopeError}</Alert>}
      {formError && <Alert className="mb-4">{formError}</Alert>}

      <FormProvider {...methods}>
        <form
          // Two submit paths, so neither button is a plain type="submit" — each calls handleSubmit with
          // its own flag. onSubmit still handles Enter in a text field, defaulting to save-as-draft.
          onSubmit={handleSubmit((values) => submit(values, false))}
          noValidate
          className="flex max-w-2xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
        >
          <Select
            label="Class and subject"
            required
            disabled={scopeLoading}
            placeholder={scopeLoading ? "Loading…" : "Choose a class and subject"}
            options={(scope?.items ?? []).map((item) => ({
              value: scopeKey(item),
              label: `${item.className} (${item.classCode}) — ${item.subjectName}`,
            }))}
            hint="Only the classes and subjects you are assigned to."
            error={errors.teachingScopeKey?.message}
            {...register("teachingScopeKey")}
          />

          <AssignmentFields />

          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="submit" loading={isSubmitting} variant="secondary">
              Save as draft
            </Button>

            <Button
              type="button"
              loading={isSubmitting}
              onClick={handleSubmit((values) => submit(values, true))}
            >
              Save and publish
            </Button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}
