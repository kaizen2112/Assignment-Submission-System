"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, FileText, PenLine } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { LateBadge, SubmissionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CARD_CLASS, CardLabel } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MarksMeter } from "@/components/ui/MarksMeter";
import { Skeleton, SkeletonRegion, TextSkeleton } from "@/components/ui/Skeleton";
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

  const backHref = `/teacher/assignments/${id}/submissions`;

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
  // Feeds the meter below the input. Watched rather than read on blur so the bar tracks typing.
  const marks = useWatch({ control, name: "marks" });

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

      router.replace(backHref);
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
        <PageHeader title="Grade submission" backHref={backHref} backLabel="Submissions" />
        <SkeletonRegion label="Loading submission" className="grid gap-6 lg:grid-cols-5">
          <Card className="p-6 lg:col-span-3">
            <Skeleton className="mb-2 h-5 w-40" />
            <Skeleton className="mb-6 h-3 w-24" />
            <TextSkeleton lines={8} />
          </Card>
          <Card className="p-6 lg:col-span-2">
            <Skeleton className="mb-5 h-4 w-32" />
            <Skeleton className="mb-2 h-14 w-full rounded-lg" />
            <Skeleton className="mb-6 h-1.5 w-full rounded-full" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </Card>
        </SkeletonRegion>
      </>
    );
  }

  if (loadError || !submission) {
    return (
      <>
        <PageHeader title="Grade submission" backHref={backHref} backLabel="Submissions" />
        <Alert className="mb-6">{loadError ?? "This submission could not be found."}</Alert>
        <Link href={backHref}>
          <Button variant="secondary">Back to submissions</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      {/* The student's name is the page title — this screen is about one person's work, and the
          assignment it belongs to is context for it rather than the other way round. */}
      <PageHeader
        title={submission.studentName}
        subtitle={submission.assignmentTitle}
        backHref={backHref}
        backLabel="Submissions"
        crumbs={[
          { label: "Assignments", href: "/teacher/assignments" },
          { label: "Submissions", href: backHref },
          { label: submission.studentName },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <SubmissionStatusBadge status={submission.status} />
            <LateBadge isLate={submission.isLate} />
          </div>
        }
      />

      {formError && <Alert className="mb-6">{formError}</Alert>}

      {/* items-start so the sticky grade card can actually stick — a stretched grid item fills the row
          height and has nothing left to scroll within. */}
      <div className="grid items-start gap-6 lg:grid-cols-5">
        {/* The answer gets the wider column: it is what the teacher is actually reading. */}
        <Card as="section" aria-label="Student answer" className="lg:col-span-3">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar fullName={submission.studentName} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-gray-900">
                  {submission.studentName}
                </h2>
                <p className="truncate text-sm text-gray-500">{submission.assignmentTitle}</p>
              </div>
            </div>

            <p className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400">
              <Clock aria-hidden="true" className="size-3.5" />
              {formatDateTime(submission.submittedAt)}
            </p>
          </header>

          <div className="px-6 py-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText aria-hidden="true" className="size-3.5 text-gray-400" />
              <CardLabel as="h3">Answer</CardLabel>
            </div>

            {/* The left accent rule is what makes this read as a quotation of someone else's writing
                rather than as more of the app's own text. */}
            <div className="max-h-160 overflow-y-auto border-l-2 border-gray-200 pl-5">
              {/* whitespace-pre-wrap: the answer is plain text and its line breaks are the student's
                  own. Rendering it as HTML would both lose them and invite injection. break-words stops
                  a long unbroken string from widening the whole layout. */}
              <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-gray-700">
                {submission.answerText}
              </p>
            </div>

            {submission.updatedAt && (
              <p className="mt-4 text-xs text-gray-400">
                Edited {formatDateTime(submission.updatedAt)}
              </p>
            )}
          </div>
        </Card>

        {/* Sticky so the marks input stays put while the teacher scrolls a long answer — the single
            biggest annoyance of the old two-column layout. top-20 clears the 56px sticky top bar. */}
        <div className="lg:sticky lg:top-20 lg:col-span-2">
          {/* A plain <form> with the card class rather than Card itself: this element needs onSubmit and
              noValidate, and threading arbitrary form props through a presentational wrapper buys
              nothing. */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className={CARD_CLASS}>
            <header className="border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-2">
                <PenLine aria-hidden="true" className="size-4 text-indigo-600" />
                <h2 className="text-base font-semibold text-gray-900">Grade submission</h2>
              </div>

              {submission.status === "Graded" && (
                <p className="mt-1.5 text-sm text-gray-500">
                  Currently {formatMarks(submission.marks, submission.maxMarks)}, graded{" "}
                  {formatDateTime(submission.gradedAt)}. Saving again replaces it.
                </p>
              )}
            </header>

            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-2">
                {/* The mark is the whole point of this form, so it gets the large treatment and the
                    maximum sits inside the field as a suffix rather than in a separate hint line. */}
                <Input
                  label="Marks"
                  type="number"
                  required
                  emphasis
                  min={0}
                  max={submission.maxMarks}
                  step={1}
                  suffix={`/ ${submission.maxMarks}`}
                  error={errors.marks?.message}
                  // valueAsNumber so Zod's rule-5 bound compares numbers, not "85" against 100.
                  {...register("marks", { valueAsNumber: true })}
                />

                {/* Visual only — it enforces nothing. See the note in MarksMeter. */}
                <MarksMeter marks={marks} maxMarks={submission.maxMarks} />
              </div>

              <Textarea
                label="Feedback"
                rows={8}
                maxLength={FEEDBACK_MAX}
                showCount
                value={feedback}
                className="min-h-50"
                placeholder="Optional. What did the student do well, and what should they change?"
                error={errors.feedback?.message}
                {...register("feedback")}
              />

              <div className="flex flex-col gap-2">
                <Button type="submit" loading={isSubmitting} className="w-full">
                  {submission.status === "Graded" ? "Update grade" : "Save grade"}
                </Button>

                <Link href={backHref} className="w-full">
                  <Button type="button" variant="ghost" className="w-full">
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
