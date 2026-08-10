"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  // The server's field message from ApiError.fieldError(), or a Zod message. Rendering it here keeps
  // every form's error placement identical.
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, ...rest }: InputProps) {
  // useId rather than a caller-supplied id: guarantees label/input association without asking every
  // call site to invent a unique string.
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {rest.required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        )}
      </label>

      <input
        id={id}
        // Announces the invalid state to screen readers, not just to sighted users via colour.
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
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
