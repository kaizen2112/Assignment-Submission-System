"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  // Renders a spinner and blocks further clicks. Separate from `disabled` so a caller can express
  // "busy" without losing the reason a button was disabled to begin with.
  loading?: boolean;
  // Rendered before the label. Pass a bare Lucide element (`<Plus />`) — it is sized by the wrapper
  // below rather than at the call site, so 30 buttons cannot end up with 4 different icon sizes.
  icon?: ReactNode;
  children: ReactNode;
}

// Dark mode keeps indigo-600 on the primary button rather than lightening it. It is the one saturated
// colour in the app and it carries the same meaning on either ground — dimming it in dark mode would
// make the main action of a screen the quietest thing on it.
const VARIANTS: Record<Variant, string> = {
  // The one accent, reserved for the single most likely action on a screen. Two indigo buttons side by
  // side means neither is the primary one.
  //
  // A gradient rather than the flat indigo-600 it replaced, but only one stop of it: indigo-500 down to
  // indigo-600, so the lit edge is at the top where a light source would put it. The button's *darkest*
  // point is still indigo-600, which is what the white label's contrast was checked against — a gradient
  // that lightened the bottom instead would have quietly moved the label onto a paler ground.
  primary:
    "bg-linear-to-b from-indigo-500 to-indigo-600 text-white shadow-sm " +
    "hover:from-indigo-600 hover:to-indigo-700 hover:shadow-md",
  secondary:
    "bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 hover:shadow-md dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700",
  // Tinted rather than solid red. A solid red button draws the eye harder than the primary action,
  // which is backwards for something you mostly do not want people clicking.
  danger:
    "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/70",
  ghost:
    "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  // 40px, matching the input height, so a button beside a field lines up without a nudge.
  md: "h-10 gap-2 px-5 text-sm",
  lg: "h-11 gap-2 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
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
        "inline-flex items-center justify-center rounded-lg font-medium",
        // The press. `active:` fires on mouse-down and on Enter/Space, so the button dips for the
        // keyboard too. 2% is under the threshold where it reads as the button resizing rather than as
        // it being pushed — and because it scales about its own centre, nothing around it moves.
        "pressable active:scale-[0.98]",
        // Nothing to press when the button is refusing the click, so the scale is dropped along with
        // the pointer. A control that dips and then does nothing feels broken rather than disabled.
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {/* The spinner replaces the icon rather than joining it, so the label never shifts sideways
          when a click starts. The child selector sizes whatever icon was passed in. */}
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
      ) : icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:size-4">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
