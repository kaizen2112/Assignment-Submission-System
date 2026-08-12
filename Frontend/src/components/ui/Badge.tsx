import type { ReactNode } from "react";
import { assignmentStatusTone, cn, submissionStatusTone } from "@/lib/utils";
import type { BadgeTone } from "@/lib/utils";
import type { AssignmentStatus, SubmissionStatus } from "@/types/api";

// A server component: a status chip has no interactivity, so shipping it as a client component would
// add JS to the bundle for nothing.
//
// Every status in the app is a coloured chip, never plain text — a table of statuses is something people
// scan rather than read, and colour is what makes that possible. The tones are tint-on-white with no
// ring: a border around a pastel chip reads as a disabled button.

// Each tone flips from tint-on-white to a translucent deep fill with a light text. The pattern is fixed:
// `-950/40` for the fill and `-300` for the text.
//
// Both halves have to move. Keeping the light `-50` fill in dark mode would put a bright chip on a dark
// table — a status is meant to be scannable, not the brightest thing on the page. Keeping the `-700`
// text on the new dark fill would fail contrast outright. And the fill is translucent rather than solid
// so the chip tints the surface it sits on, which is what keeps it looking attached to the row.
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  success: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  late: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  danger: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  accent: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",

  // Role pills only — see the note on BadgeTone. Not part of the status palette.
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1",
        "text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Two thin wrappers so a caller never has to remember which tone a status maps to — the mapping lives
// in utils.ts and both the chip and any table cell read it from there.

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge tone={assignmentStatusTone(status)}>{status}</Badge>;
}

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  // "NotSubmitted" is the one status whose PascalCase reads badly to a user.
  const label = status === "NotSubmitted" ? "Not submitted" : status;

  return <Badge tone={submissionStatusTone(status)}>{label}</Badge>;
}

// Deadlines are the thing users scan for, so overdue gets its own chip rather than being inferred
// from a date they have to read.
export function OverdueBadge({ isOverdue }: { isOverdue: boolean }) {
  return isOverdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="success">Open</Badge>;
}

export function LateBadge({ isLate }: { isLate: boolean }) {
  return isLate ? <Badge tone="late">Late</Badge> : null;
}

// The subject chip on assignment cards and rows. Accent-tinted because it is a label for the thing
// itself rather than a status — so it must not be mistaken for one.
export function SubjectBadge({ children }: { children: ReactNode }) {
  return <Badge tone="accent">{children}</Badge>;
}
