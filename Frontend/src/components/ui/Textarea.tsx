"use client";

import { useId } from "react";
import type { ComponentPropsWithRef } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_BASE, FIELD_TONE } from "@/components/ui/Input";

// ComponentPropsWithRef so React Hook Form's register() can be spread straight in — see the note in
// Input.tsx.
interface TextareaProps extends Omit<ComponentPropsWithRef<"textarea">, "id"> {
  label: string;
  error?: string;
  hint?: string;
  // Renders "1234 / 5000" under the field. The backend caps AnswerText at 5000 and Description at
  // 5000, and a student losing a long answer to a 400 is the worst failure this app can have.
  showCount?: boolean;
}

export function Textarea({
  label,
  error,
  hint,
  showCount = false,
  className,
  maxLength,
  value,
  rows = 6,
  ...rest
}: TextareaProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const length = typeof value === "string" ? value.length : 0;
  const atLimit = maxLength !== undefined && length >= maxLength;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-gray-700">
          {label}
          {rest.required && (
            <span aria-hidden="true" className="ml-0.5 text-red-500">
              *
            </span>
          )}
        </label>

        {showCount && maxLength !== undefined && (
          // gray-400 until it matters: a counter that is always dark competes with the label for
          // attention while saying nothing useful at 12 of 5000 characters.
          <span className={cn("text-xs tabular-nums", atLimit ? "text-red-500" : "text-gray-400")}>
            {length} / {maxLength}
          </span>
        )}
      </div>

      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          FIELD_BASE,
          error ? FIELD_TONE.error : FIELD_TONE.normal,
          // Generous by default and still resizable. A cramped textarea makes people write less, which
          // is the wrong incentive for an answer box and for teacher feedback alike.
          "min-h-30 resize-y py-2.5 leading-relaxed",
          className,
        )}
        {...rest}
      />

      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-red-500">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
