"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  // Renders a spinner and blocks further clicks. Separate from `disabled` so a caller can express
  // "busy" without losing the reason a button was disabled to begin with.
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900",
  secondary:
    "bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  // Destructured out of `rest` deliberately. Left in, the {...rest} spread below would re-apply
  // type={undefined} *after* the explicit attribute and the browser would fall back to its default
  // of "submit" — silently submitting any enclosing form.
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // A loading button must not be clickable, or a double submit creates two assignments.
      disabled={disabled || loading}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
