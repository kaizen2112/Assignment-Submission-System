"use client";

import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ComponentPropsWithRef, not InputHTMLAttributes: React Hook Form's register() returns a `ref` along
// with name/onChange/onBlur, and the whole point is to spread that object onto the field in one go.
// InputHTMLAttributes does not declare a ref, so `<Input {...register("email")} />` would not compile.
// No forwardRef needed — React 19 passes ref to function components as an ordinary prop, so it rides
// along in `rest` and lands on the <input> below.
interface InputProps extends Omit<ComponentPropsWithRef<"input">, "id"> {
  label: string;
  // The server's field message from ApiError.fieldError(), or a Zod message. Rendering it here keeps
  // every form's error placement identical.
  error?: string;
  hint?: string;
  // A short unit or "/ 100" shown inside the field on the right. Used by the marks input, where the
  // maximum belongs beside the number rather than in a separate line of hint text.
  suffix?: ReactNode;
  // Bigger, heavier text for a single number that is the whole point of a form.
  emphasis?: boolean;
}

// One border/focus treatment for every field in the app. 40px tall, indigo ring on focus, red only when
// something is actually wrong.
export const FIELD_BASE = cn(
  "w-full rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400",
  "transition-shadow duration-150",
  "focus:outline-none focus:ring-2",
  // The dark twin of this line is `dark:disabled:*` below — NOT a bare `dark:text-*`. A bare one would
  // apply to every field in dark mode, not just the disabled ones, and would then race the intended
  // `dark:text-gray-100` for which of the two Tailwind emits last.
  "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
  // A field is the one thing that must not match the card it sits in — you have to be able to see where
  // you are allowed to type. In light mode white-on-gray does that; in dark mode the card is gray-800,
  // so the field goes *darker* rather than lighter, which is the inversion people expect from an inset.
  "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500",
  "dark:disabled:bg-gray-900 dark:disabled:text-gray-500",
);

export const FIELD_TONE = {
  normal: "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/30",
  error: "border-red-400 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500",
} as const;

export function Input({
  label,
  error,
  hint,
  suffix,
  emphasis = false,
  className,
  ...rest
}: InputProps) {
  // useId rather than a caller-supplied id: guarantees label/input association without asking every
  // call site to invent a unique string.
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  // Boolean, not the ReactNode itself: `suffix && "pr-14"` evaluates to 0 for a suffix of `0`, and cn()
  // only accepts strings and falsy values.
  const hasSuffix = suffix !== undefined && suffix !== null && suffix !== false;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {label}
        {rest.required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </label>

      {/* Relative wrapper only so the suffix can sit inside the field. */}
      <div className="relative">
        <input
          id={id}
          // Announces the invalid state to screen readers, not just to sighted users via colour.
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            FIELD_BASE,
            error ? FIELD_TONE.error : FIELD_TONE.normal,
            emphasis ? "h-14 text-2xl font-bold tabular-nums" : "h-10",
            hasSuffix && (emphasis ? "pr-20" : "pr-14"),
            className,
          )}
          {...rest}
        />

        {hasSuffix && (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-3 flex items-center",
              "font-medium text-gray-400 dark:text-gray-500",
              emphasis ? "text-xl tabular-nums" : "text-sm",
            )}
          >
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        // Icon + message. Colour alone is not a reliable signal, and a warning glyph reads as an error
        // even to someone who cannot distinguish the red.
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-sm text-red-500 dark:text-red-400"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
