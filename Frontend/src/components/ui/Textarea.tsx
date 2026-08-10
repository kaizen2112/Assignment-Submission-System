"use client";

import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
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
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {rest.required && (
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          )}
        </label>

        {showCount && maxLength !== undefined && (
          <span
            className={cn("text-xs tabular-nums", atLimit ? "text-red-600" : "text-slate-500")}
          >
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
          "resize-y rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
          "focus:outline-2 focus:outline-offset-0",
          error
            ? "border-red-400 focus:outline-red-500"
            : "border-slate-300 focus:outline-slate-400",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          className,
        )}
        {...rest}
      />

      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
