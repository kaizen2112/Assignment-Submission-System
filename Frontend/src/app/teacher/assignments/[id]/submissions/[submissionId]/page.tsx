"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { findSubmission, gradeSubmission } from "@/lib/assignments";
import { FEEDBACK_MAX, gradeSchema } from "@/lib/schemas";
import type { GradeValues } from "@/lib/schemas";
import { formatDateTime, formatMarks } from "@/lib/utils";

export default function GradeSubmissionPage() {
  const router = useRouter();
  const { id, submissionId } = useParams<{ id: string; submissionId: string }>();

  const [formError, setFormError] = useState<string | null>(null);

  const loader = useCallback(
    (signal: AbortSignal) => findSubmission(id, submissionId, signal),
    [id, submissionId],
  );
  const { data: submission, error: loadError, loading } = useAsync(loader);

  // maxMarks is on the submission, so the schema cannot exist until it loads. Rebuilt only when maxMarks
  // actually changes — a new schema object on every render would reset the resolver mid-edit.
  const maxMarks = submission?.maxMarks ?? 0;
  const resolver = useMemo(() => zodResolver(gradeSchema(maxMarks)), [maxMarks]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GradeValues>({
    resolver,
    mode: "onBlur",
    defaultValues: { marks: 0, feedback: "" },
  });

  // useWatch, not watch(): watch() returns a fresh function that React Compiler cannot memoize, so it
  // silently skips optimizing this whole component. useWatch also subscribes to just this one field
  // rather than re-rendering on every keystroke anywhere in the form.
  const feedback = useWatch({ control, name: "feedback" });

  // Pre-fill from the existing grade so re-grading starts from what is already there rather than from
  // zero — a teacher nudging 84 to 85 should not have to retype the feedback.
  useEffect(() => {
    if (!submission) return;

    reset({
      marks: submission.marks ?? 0,
      feedback: submission.feedback ?? "",
    });
  }, [submission, reset]);

  const onSubmit = async (values: GradeValues) => {
    setFormError(null);

    try {
      await gradeSubmission(id, submissionId, {
        marks: values.marks,
        // Empty textarea means "no feedback", which the API models as null rather than "".
        feedback: values.feedback.trim() === "" ? null : values.feedback.trim(),
      });

      router.replace(`/teacher/assignments/${id}/submissions`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        // The authoritative rule-5 upper bound lives in SubmissionService, which is the only place that
        // can see the parent assignment's MaxMarks. The client schema checks the same bound, so this
        // branch fires mainly if maxMarks changed underneath us — and it belongs on the field.
        const marksError = caught.fieldError("marks");
        const feedbackError = caught.fieldError("feedback");

        if (marksError) setError("marks", { message: marksError });
        if (feedbackError) setError("feedback", { message: feedbackError });
        if (!marksError && !feedbackError) setFormError(caught.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Grade submission" backHref={`/teacher/assignments/${id}/submissions`} backLabel="Submissions" />
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      </>
    );
  }

  if (loadError || !submission) {
    return (
      <>
        <PageHeader title="Grade submission" backHref={`/teacher/assignments/${id}/submissions`} backLabel="Submissions" />
        <Alert className="mb-4">{loadError ?? "This submission could not be found."}</Alert>
        <Link href={`/teacher/assignments/${id}/submissions`}>
          <Button variant="secondary">Back to submissions</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={submission.studentName}
        subtitle={submission.assignmentTitle}
        backHref={`/teacher/assignments/${id}/submissions`}
        backLabel="Submissions"
        action={
          <div className="flex flex-wrap items-center gap-1">
            <SubmissionStatusBadge status={submission.status} />
            <LateBadge isLate={submission.isLate} />
          </div>
        }
      />

      {formError && <Alert className="mb-4">{formError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* The answer gets the wider column: it is what the teacher is actually reading. */}
        <section aria-label="Student answer" className="lg:col-span-3">
          <div className="rounded-lg border border-slate-200 bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-2">
              <h2 className="text-sm font-semibold text-slate-900">Answer</h2>
              <p className="text-xs text-slate-500">
                Submitted {formatDateTime(submission.submittedAt)}
                {submission.updatedAt && ` · edited ${formatDateTime(submission.updatedAt)}`}
              </p>
            </header>

            {/* whitespace-pre-wrap: the answer is plain text and its line breaks are the student's own.
                Rendering it as HTML would both lose them and invite injection. break-words stops a long
                unbroken string from widening the whole layout. */}
            <div className="max-h-128 overflow-y-auto px-4 py-3">
              <p className="whitespace-pre-wrap wrap-break-word text-sm text-slate-800">
                {submission.answerText}
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Grading" className="lg:col-span-2">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Grade</h2>
              {submission.status === "Graded" && (
                <p className="mt-1 text-xs text-slate-500">
                  Currently {formatMarks(submission.marks, submission.maxMarks)}, graded{" "}
                  {formatDateTime(submission.gradedAt)}. Saving again replaces it.
                </p>
              )}
            </div>

            <Input
              label={`Marks (out of ${submission.maxMarks})`}
              type="number"
              required
              min={0}
              max={submission.maxMarks}
              step={1}
              hint={`0 to ${submission.maxMarks}.`}
              error={errors.marks?.message}
              // valueAsNumber so Zod's rule-5 bound compares numbers, not "85" against 100.
              {...register("marks", { valueAsNumber: true })}
            />

            <Textarea
              label="Feedback"
              rows={8}
              maxLength={FEEDBACK_MAX}
              showCount
              value={feedback}
              placeholder="Optional. What did the student do well, and what should they change?"
              error={errors.feedback?.message}
              {...register("feedback")}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={isSubmitting}>
                {submission.status === "Graded" ? "Update grade" : "Save grade"}
              </Button>

              <Link href={`/teacher/assignments/${id}/submissions`}>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
