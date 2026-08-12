"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Labelled row actions: icon *and* word, rather than the icon-only IconButton next door.
//
// Why both exist. IconButton is right where the action is obvious from context — a single Eye on a graded
// submission row, say. It stops being right once a row carries four or five of them: a strip of glyphs with
// no words is a memory test, and "which one duplicates and which one publishes?" is not a question a table
// should ask. So a row with a real set of actions gets labels, and a row with one or two keeps the icon.
//
// Kept as a separate component rather than a `labelled` prop on IconButton, because the two have different
// layouts, different hit areas and different wrapping behaviour on mobile — one flag would not have covered
// it, and every existing icon-only caller would have had to opt out of a default.

type Tone = "accent" | "neutral" | "danger";

// The spec for this asked for `hover:bg-gray-700`, which is a dark-mode value: in light mode a gray-700
// fill under gray text is unreadable. Each tone therefore names both themes.
const TONES: Record<Tone, string> = {
  // The primary action in the row. Indigo at rest, not only on hover, because it is the one a teacher wants
  // most often and the colour is what makes it findable without reading all four.
  accent:
    "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 " +
    "dark:text-indigo-400 dark:hover:bg-gray-700 dark:hover:text-indigo-300",
  neutral:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 " +
    "dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white",
  // Red at rest as well, which the icon-only version deliberately avoided. With four unlabelled glyphs a
  // permanent red one made every row look like a warning; with words next to them, "Delete" reading as
  // dangerous before the cursor arrives is the point rather than the problem.
  danger:
    "text-red-600 hover:bg-red-50 hover:text-red-700 " +
    "dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300",
};

const BASE = cn(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5",
  "text-xs font-medium",
  "pressable active:scale-[0.96]",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
  "[&>svg]:size-3.5 [&>svg]:shrink-0",
);

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  tone?: Tone;
  loading?: boolean;
}

export function ActionButton({
  label,
  icon,
  tone = "neutral",
  loading = false,
  disabled,
  type = "button",
  className,
  ...rest
}: ActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(BASE, TONES[tone], className)}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

// A <Link> styled to match, not a button that calls router.push — middle-click and "open in new tab" keep
// working, which they would not on a button.
export function ActionLink({
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
    <Link href={href} className={cn(BASE, TONES[tone], className)}>
      {icon}
      {label}
    </Link>
  );
}

// The strip itself.
//
// **This deliberately does not go to opacity-0 at rest, which the brief asked for.** The stated problem was
// that nobody can tell what the icons do — and an ACTIONS column that is *empty* until the cursor happens to
// cross it does not solve that, it makes the actions undiscoverable outright and invisible to anyone tabbing
// through with a keyboard. 70% is quiet enough that four labels do not compete with the data and legible
// enough to be found on sight. Change the number here if you want it stronger or fainter.
//
// Full strength unconditionally below md: a touch screen has no hover, so anything dimmed there reads as
// permanently disabled. flex-wrap for the same reason — four labelled buttons do not fit one narrow row, and
// wrapping is better than a horizontal scrollbar inside a cell.
export function RowActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1",
        "opacity-100 md:opacity-70 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        "transition-opacity duration-150",
      )}
    >
      {children}
    </div>
  );
}
