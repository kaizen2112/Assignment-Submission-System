"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon-only actions for the last column of a table. Text buttons in every row turn a table into a wall
// of words; an icon that appears on hover keeps the data readable and the action one pixel away.
//
// `label` is required and is NOT optional decoration — an icon-only control with no accessible name is
// invisible to a screen reader, so it becomes both the aria-label and the native tooltip.

type Tone = "neutral" | "danger";

// Both tones start from the same neutral gray and only diverge on hover — the danger action should not
// announce itself as red until the cursor is actually on it, or every table row reads as a warning.
const TONES: Record<Tone, string> = {
  neutral:
    "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100",
  danger:
    "text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400",
};

const BASE = cn(
  // A 32px hit area with the icon at 16px — the tinted square on hover is what makes it read as a
  // button rather than a bare glyph floating in a cell.
  "inline-flex size-8 items-center justify-center rounded-lg",
  "pressable active:scale-[0.92]",
  // Deeper than the 0.98 on Button: this control is a quarter the size, and the same ratio on a 32px
  // square is too small a movement to register as a press.
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
  "[&>svg]:size-4",
);

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  tone?: Tone;
  loading?: boolean;
}

export function IconButton({
  label,
  icon,
  tone = "neutral",
  loading = false,
  disabled,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(BASE, TONES[tone], className)}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon}
    </button>
  );
}

// The same control as a navigation. A <Link> styled as a button rather than a button that calls
// router.push, so middle-click and "open in new tab" keep working.
export function IconLink({
  href,
  label,
  icon,
  tone = "neutral",
  className,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Link href={href} aria-label={label} title={label} className={cn(BASE, TONES[tone], className)}>
      {icon}
    </Link>
  );
}

// Wraps a row's actions: dimmed until the row is hovered, then full strength.
//
// 60% rather than 0. Fully hidden actions are undiscoverable — nothing tells you a row has an Edit
// button until you happen to sweep the cursor over it, and a keyboard user tabbing through has no idea
// the controls exist. At 60% they are legible enough to find and quiet enough that a page of them does
// not compete with the data.
//
// Still opacity and not `hidden`: an element removed from the layout would make every row jump by 32px
// as the cursor crossed it. And focus-within is what brings them to full strength for the keyboard,
// which the hover rule alone would never do.
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1",
        // Full strength unconditionally below md: a touch screen has no hover, so a dimmed control there
        // would simply look permanently disabled.
        "opacity-100 md:opacity-60 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        "transition-opacity duration-150",
      )}
    >
      {children}
    </div>
  );
}
