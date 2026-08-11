"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api";
import { submitAnswer, updateMySubmission } from "@/lib/assignments";
import { ANSWER_MAX, submissionSchema } from "@/lib/schemas";
import type { SubmissionValues } from "@/lib/schemas";
import type { Assignment, Submission } from "@/types/api";

// What the student may actually do, derived once from the two business rules that govern it.
//
// The asymmetry here is easy to get wrong and is deliberate in the backend: AllowLateSubmission buys a
// student one late *delivery*, not an open editing window afterwards. So a late submission is read-only
// the moment it is made — rule 1 lets it in, rule 2 immediately locks it.
type Mode =
  | "submit" // nothing submitted yet, and submitting is still permitted
  | "submit-late" // nothing submitted, deadline passed, but the assignment allows late delivery
  | "update" // already submitted, before the deadline, not yet graded
  | "closed-deadline" // deadline passed — no submitting (or no further editing)
  | "closed-graded"; // graded, and grading is final for the student (assumption A1)

function resolveMode(assignment: Assignment, submission: Submission | null): Mode {
  if (submission === null) {
    if (!assignment.isOverdue) return "submit";
    return assignment.allowLateSubmission ? "submit-late" : "closed-deadline";
  }

  // Graded is checked first for the *message*, since it is the more specific reason — but note the
  // backend checks the deadline first, so a graded-and-overdue submission is rejected by the deadline
  // rule there. Either way it is closed; this only decides which sentence the student reads.
  if (submission.status === "Graded") return "closed-graded";

  return assignment.isOverdue ? "closed-deadline" : "update";
}

export function SubmissionForm({
  assignment,
  submission,
  onSaved,
}: {
  assignment: Assignment;
  submission: Submission | null;
  onSaved: (saved: Submission) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const mode = resolveMode(assignment, submission);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
    mode: "onBlur",
    // Pre-filled when updating, so a student edits their answer rather than retyping it.
    defaultValues: { answerText: submission?.answerText ?? "" },
  });

  const answerText = useWatch({ control, name: "answerText" });

  const onSubmit = async (values: SubmissionValues) => {
    setFormError(null);

    try {
      const saved =
        submission === null
          ? await submitAnswer(assignment.id, { answerText: values.answerText })
          : await updateMySubmission(assignment.id, { answerText: values.answerText });

      onSaved(saved);
    } catch (caught) {
      if (caught instanceof ApiError) {
        // The API reports the field as "answerText" when the body fails validation.
        const fieldMessage = caught.fieldError("answerText");

        if (fieldMessage) {
          setError("answerText", { message: fieldMessage });
        } else {
          // Everything else is a rule the client cannot fully know at render time — the deadline
          // passing while this page sat open, or a teacher grading it in the meantime. The server's
          // sentence is the accurate one, so it is shown as-is.
          setFormError(caught.message);
        }
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  // --- Closed states: no form at all, because nothing can be sent ---------------------------------

  if (mode === "closed-graded" || mode === "closed-deadline") {
    return (
      <Alert tone={mode === "closed-graded" ? "info" : "warning"}>
        {mode === "closed-graded"
          ? "This submission has been graded, so it can no longer be changed."
          : submission === null
            ? "The deadline has passed and this assignment does not accept late submissions."
            : "The deadline has passed, so your submission can no longer be edited."}
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {mode === "submit-late" && (
        <Alert tone="warning">
          The deadline has passed. You can still submit, but your work will be recorded as{" "}
          <strong>late</strong> — and it cannot be edited afterwards.
        </Alert>
      )}

      {mode === "update" && (
        <Alert tone="info">
          You have already submitted. You can keep editing until the deadline, or until your teacher
          grades it.
        </Alert>
      )}

      {formError && <Alert>{formError}</Alert>}

      <Textarea
        label="Your answer"
        required
        rows={12}
        maxLength={ANSWER_MAX}
        showCount
        value={answerText}
        placeholder="Type your answer here."
        error={errors.answerText?.message}
        {...register("answerText")}
      />

      <div>
        <Button type="submit" loading={isSubmitting}>
          {submission === null ? "Submit answer" : "Update answer"}
        </Button>
      </div>
    </form>
  );
}
