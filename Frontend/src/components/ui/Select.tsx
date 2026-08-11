"use client";

import { useId } from "react";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

// ComponentPropsWithRef so React Hook Form's register() can be spread in — see the note in Input.tsx.
interface SelectProps extends Omit<ComponentPropsWithRef<"select">, "id"> {
  label: string;
  error?: string;
  hint?: string;
  // Rendered as a disabled first option. A native <select> otherwise pre-selects its first real option,
  // so without this a form would silently submit whatever happened to come first.
  placeholder?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  error,
  hint,
  placeholder,
  options,
  className,
  ...rest
}: SelectProps) {
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

      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "rounded-md border bg-white px-3 py-2 text-sm text-slate-900",
          "focus:outline-2 focus:outline-offset-0",
          error
            ? "border-red-400 focus:outline-red-500"
            : "border-slate-300 focus:outline-slate-400",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
