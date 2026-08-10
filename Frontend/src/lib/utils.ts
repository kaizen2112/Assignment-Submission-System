import type { AssignmentStatus, SubmissionStatus } from "@/types/api";

// Joins class names, dropping falsy entries so `cn("a", cond && "b")` reads cleanly at call sites.
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// The API returns UTC ISO strings; these render in the viewer's local timezone, which is what a
// deadline should show. `undefined` locale means "use the browser's".
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "in 3 days" / "2 days ago" for deadline urgency. Uses Intl.RelativeTimeFormat so it localises.
export function formatRelative(iso: string): string {
  const target = new Date(iso).getTime();
  const diffMs = target - Date.now();
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === "minute") {
      return formatter.format(Math.round(diffMs / ms), unit);
    }
  }

  return formatter.format(0, "minute");
}

// Status → Badge tone. Kept here rather than inside Badge so the mapping is testable and reusable in
// a table cell that is not a Badge.
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function assignmentStatusTone(status: AssignmentStatus): BadgeTone {
  return status === "Published" ? "success" : "neutral";
}

export function submissionStatusTone(status: SubmissionStatus): BadgeTone {
  switch (status) {
    case "Graded":
      return "success";
    case "Submitted":
      return "info";
    case "Late":
      return "warning";
    case "NotSubmitted":
      return "neutral";
  }
}

// "45 / 50" for a graded submission, an em dash while it is still ungraded — 0 is a real mark, so a
// falsy check here would wrongly show an em dash for a zero score.
export function formatMarks(marks: number | null, maxMarks: number): string {
  return marks === null ? "—" : `${marks} / ${maxMarks}`;
}
