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

      {/* Two fields on one row: a datetime and a small number are both narrow, and stacking them wastes
          the width a card already has. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Deadline"
          type="datetime-local"
          required
          // Shown and entered in the browser's local timezone; converted to UTC on submit. See
          // dateTimeLocalToUtcIso in lib/utils.ts for why that conversion is not optional.
          hint="Your local time. Students see this in their own timezone."
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
          hint={`Between ${MIN_MARKS} and ${MAX_MARKS_LIMIT}.`}
          error={errors.maxMarks?.message}
          // valueAsNumber so Zod validates a number rather than the string a number input really returns.
          {...register("maxMarks", { valueAsNumber: true })}
        />
      </div>

      {/* Not the Input component: a checkbox needs its label beside the box, not above it. Wrapped in a
          tinted panel so it reads as a setting rather than as another text field left blank.

          The explanation is deliberately *outside* the <label> and attached with aria-describedby.
          Nested inside, it becomes part of the checkbox's accessible name, so a screen reader announces
          the entire sentence as the field's name instead of "Allow late submissions". */}
      {/* The tint has to go the other way in dark mode. gray-50 is a shade *down* from the white card;
          on a gray-800 card the equivalent is a shade down from that, not up — a lighter panel here would
          read as a raised tile rather than as an inset setting. */}
      <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
        <input
          id={lateSubmissionId}
          type="checkbox"
          aria-describedby={`${lateSubmissionId}-hint`}
          // accent-indigo-600 is what colours the tick itself; the browser draws the rest of the control
          // from `color-scheme`, which globals.css now sets per theme — so the empty box goes dark
          // without any class here having to say so.
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-gray-300 text-indigo-600 accent-indigo-600 dark:border-gray-600"
          {...register("allowLateSubmission")}
        />
        <div>
          <label
            htmlFor={lateSubmissionId}
            className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Allow late submissions
          </label>
          <p
            id={`${lateSubmissionId}-hint`}
            className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
          >
            When off, the API rejects anything submitted after the deadline.
          </p>
        </div>
      </div>
    </>
  );
}
