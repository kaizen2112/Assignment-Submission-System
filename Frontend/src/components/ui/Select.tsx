"use client";

import { useId } from "react";
import type { ComponentPropsWithRef } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_BASE, FIELD_TONE } from "@/components/ui/Input";

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
      <label htmlFor={id} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {label}
        {rest.required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            FIELD_BASE,
            error ? FIELD_TONE.error : FIELD_TONE.normal,
            // appearance-none plus a drawn chevron: the native arrow is a different shape and colour in
            // every browser, and it is the one control that would give the form away as unstyled.
            "h-10 cursor-pointer appearance-none pr-10",
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

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />
      </div>

      {error ? (
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
