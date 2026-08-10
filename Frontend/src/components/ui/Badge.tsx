import type { ReactNode } from "react";
import { assignmentStatusTone, cn, submissionStatusTone } from "@/lib/utils";
import type { BadgeTone } from "@/lib/utils";
import type { AssignmentStatus, SubmissionStatus } from "@/types/api";

// A server component: a status chip has no interactivity, so shipping it as a client component would
// add JS to the bundle for nothing.

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
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
  return isOverdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="info">Open</Badge>;
}

export function LateBadge({ isLate }: { isLate: boolean }) {
  return isLate ? <Badge tone="warning">Late</Badge> : null;
}
