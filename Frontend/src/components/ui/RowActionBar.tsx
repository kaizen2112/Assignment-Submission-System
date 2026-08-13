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

// w-full + justify-start rather than shrink-to-fit: these are grid cells, and a button that sizes to its
// own label leaves four ragged left edges inside the panel — which was the "disorganised" complaint.
// Filling the cell gives two aligned columns, and the icons line up down each one.
//
// min-w-0 is the load-bearing one. A flex item's default `min-width: auto` refuses to shrink below its
// content, so a long label pushed the button wider than its grid track and painted over the neighbour
// instead of stopping at the edge. With min-w-0 the button is bounded by its track and the label below
// truncates rather than escaping.
const BASE = cn(
  "inline-flex w-full min-w-0 items-center gap-1.5 rounded-md px-2.5 py-1.5",
  "justify-start text-left text-xs font-medium",
  "pressable active:scale-[0.96]",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
  "[&>svg]:size-3.5 [&>svg]:shrink-0",
);

// The label is its own element so it can be the thing that truncates — `truncate` needs a block box with
// a width, which the flex container itself is not. Nothing actually truncates at the current labels and
// panel width; this is the guard that makes overlap structurally impossible rather than merely unlikely,
// so a longer label added later degrades to an ellipsis instead of reopening this bug.
function ActionLabel({ label }: { label: string }) {
  return <span className="truncate">{label}</span>;
}

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
      <ActionLabel label={label} />
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
      <ActionLabel label={label} />
    </Link>
  );
}

// The panel itself: a bordered 2x2 block, not a loose strip.
//
// It was `flex flex-wrap` before, which is why it looked disorganised — wrapping packs each line to its own
// width, so "View submissions / Edit" on one line and "Duplicate / Delete" on the next produced two rows
// that shared no vertical edge, and the break moved as the labels changed between a draft and a published
// row. A fixed two-column grid gives every row the same shape whichever four actions it carries.
//
// grid-cols-2 with exactly four actions per row, always — `AssignmentStatus` is only Draft | Published,
// so the grid is never ragged. Callers are expected to keep a stable action *order* so a given cell means
// the same thing on every row; see the teacher assignments table, where only the first slot varies with
// status and Edit / Duplicate / Delete never move.
//
// w-64 is a fixed width, not a min-width, and that is the point: sized to content, each row's panel was as
// wide as its own longest label, so a published row and a draft row directly beneath it disagreed about
// where the second column started. A fixed width makes every panel in the table the same object. The
// number is set by the widest label the grid has to hold in one 121px track ("Submissions"); a label wider
// than that truncates rather than overlapping, and is the signal to widen this rather than to abbreviate.
//
// The border is what turns four buttons into one object. It also replaces the old opacity trick: the strip
// used to sit at 70% and come up on row hover, which was already a compromise against the brief's
// opacity-0 — dimming a *bordered* panel just makes it look disabled, so the panel is at full strength
// always and the border alone warms on hover. Actions that are visible to everyone, including anyone
// tabbing through, were the point of labelling them in the first place.
export function RowActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        // inline-grid so the enclosing right-aligned cell can still push the panel to the edge — a
        // block-level grid would ignore the cell's text-align and sit on the left.
        "inline-grid w-64 grid-cols-2 gap-1 rounded-lg p-1 align-middle",
        "border border-gray-200 shadow-xs dark:border-gray-700",
        "bg-linear-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900/60",
        "transition-colors duration-150",
        "group-hover:border-gray-300 dark:group-hover:border-gray-600",
      )}
    >
      {children}
    </div>
  );
}
