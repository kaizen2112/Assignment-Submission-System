"use client";

import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DESCRIPTION_MAX, MAX_MARKS_LIMIT, MIN_MARKS, TITLE_MAX } from "@/lib/schemas";
import type { AssignmentValues } from "@/lib/schemas";

// The five fields create and edit have in common. Read from context rather than taking register/errors
// as props: the create form's value type extends this one, and UseFormRegister is contravariant in its
// field paths, so passing it down would need a cast. useFormContext<T>() is unchecked against the
// provider's own type, which is sound here because both schemas produce exactly these keys.
export function AssignmentFields() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AssignmentValues>();

  // Fed to Textarea so its character counter has something to count. register() alone leaves the field
  // uncontrolled and `value` undefined, which would peg the counter at 0. Safe because defaultValues
  // sets description to "" — a value that flipped between undefined and a string would make React warn
  // about switching a controlled input.
  //
  // useWatch rather than watch(): watch() returns a function React Compiler cannot memoize, which makes
  // it skip optimizing the component. useWatch also narrows the re-render to this field alone.
  const description = useWatch({ control, name: "description" });

  // The other fields get their id from the Input/Textarea components; the checkbox is hand-rolled here,
  // so it needs its own.
  const lateSubmissionId = useId();

  return (
    <>
      <Input
        label="Title"
        required
        maxLength={TITLE_MAX}
        placeholder="Algebra Problem Set 2"
        error={errors.title?.message}
        {...register("title")}
      />

      <Textarea
        label="Description"
        required
        rows={6}
        maxLength={DESCRIPTION_MAX}
        showCount
        value={description}
        placeholder="What should students do, and how will it be marked?"
        error={errors.description?.message}
        {...register("description")}
      />

      <Input
        label="Deadline"
        type="datetime-local"
        required
        // Shown and entered in the browser's local timezone; converted to UTC on submit. See
        // dateTimeLocalToUtcIso in lib/utils.ts for why that conversion is not optional.
        hint="Your local time. Students see this deadline in their own timezone."
        error={errors.deadline?.message}
        {...register("deadline")}
      />

      <Input
        label="Max marks"
        type="number"
        required
        min={MIN_MARKS}
        max={MAX_MARKS_LIMIT}
        step={1}
        error={errors.maxMarks?.message}
        // valueAsNumber so Zod validates a number rather than the string a number input really returns.
        {...register("maxMarks", { valueAsNumber: true })}
      />

      {/* Not the Input component: a checkbox needs its label beside the box, not above it.
          The explanation is deliberately *outside* the <label> and attached with aria-describedby.
          Nested inside, it becomes part of the checkbox's accessible name, so a screen reader announces
          the entire sentence as the field's name instead of "Allow late submissions". */}
      <div className="flex items-start gap-2">
        <input
          id={lateSubmissionId}
          type="checkbox"
          aria-describedby={`${lateSubmissionId}-hint`}
          className="mt-0.5 size-4 rounded border-slate-300"
          {...register("allowLateSubmission")}
        />
        <div>
          <label htmlFor={lateSubmissionId} className="text-sm text-slate-700">
            Allow late submissions
          </label>
          <p id={`${lateSubmissionId}-hint`} className="text-xs text-slate-500">
            When off, the API rejects anything submitted after the deadline.
          </p>
        </div>
      </div>
    </>
  );
}
