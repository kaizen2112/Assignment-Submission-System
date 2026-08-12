import type { AssignmentStatus, Role, SubmissionStatus } from "@/types/api";

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
//
// One tone per status the system can be in, so no two statuses ever share a colour: a student scanning a
// list should be able to tell Submitted from Late without reading the word.
//
// `purple` and `teal` are the exception — they are not statuses. They exist for the role pill, and are
// deliberately outside the status palette so a role can never be mistaken for a state.
export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "late"
  | "purple"
  | "teal";

export function assignmentStatusTone(status: AssignmentStatus): BadgeTone {
  // Draft is neutral on purpose — it is the absence of a state, not a warning.
  //
  // Published is accent (indigo) rather than info (blue): indigo is this app's "live, and yours" colour, and
  // blue was close enough to the neutral gray beside it that a scan down the column could not separate the
  // two states at a glance.
  return status === "Published" ? "accent" : "neutral";
}

export function submissionStatusTone(status: SubmissionStatus): BadgeTone {
  switch (status) {
    case "Graded":
      return "success";
    case "Submitted":
      return "warning";
    // Its own tone rather than sharing amber with Submitted: "arrived, but late" is a different fact
    // from "arrived", and the two appear side by side.
    case "Late":
      return "late";
    case "NotSubmitted":
      return "danger";
  }
}

// A role is coloured the same wherever it appears — the pill in the top bar and the Role column of the
// admin users table are the same fact about the same person, so they must not disagree.
export const ROLE_TONES: Record<Role, BadgeTone> = {
  Admin: "purple",
  Teacher: "accent",
  Student: "teal",
};

// --- Deadline urgency ----------------------------------------------------------------------------

// How close a deadline is, as a decision rather than a raw date — so DeadlineLabel, the assignment
// cards and any future countdown all agree on when "soon" starts.
export type DeadlineUrgency = "past" | "today" | "tomorrow" | "soon" | "distant";

const DAY_MS = 86_400_000;

export function deadlineUrgency(iso: string, now: number = Date.now()): DeadlineUrgency {
  const remaining = new Date(iso).getTime() - now;

  if (remaining <= 0) return "past";
  if (remaining < DAY_MS) return "today";
  if (remaining < 2 * DAY_MS) return "tomorrow";
  // 7 days is the boundary between "plan for it" and "act on it".
  return remaining < 7 * DAY_MS ? "soon" : "distant";
}

// Whole days remaining, rounded up: 1.2 days left is "2 days" to a student looking at a calendar.
export function daysUntil(iso: string, now: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / DAY_MS);
}

// Initials for an avatar. Two letters from the first and last word — "Ayesha Rahman" → "AR" — falling
// back to one for a single-word name and to "?" for an empty one, which is what a null profile renders
// as while /auth/me is still in flight.
export function initials(fullName: string | undefined | null): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

// "45 / 50" for a graded submission, an em dash while it is still ungraded — 0 is a real mark, so a
// falsy check here would wrongly show an em dash for a zero score.
export function formatMarks(marks: number | null, maxMarks: number): string {
  return marks === null ? "—" : `${marks} / ${maxMarks}`;
}

// --- <input type="datetime-local"> conversion ----------------------------------------------------
//
// The input's value has no timezone: it is always "YYYY-MM-DDTHH:mm" in the user's local time. The API
// stores UTC and documents a bare timestamp as UTC. So passing the input's value straight through would
// shift every deadline by the user's offset — six hours, here — while looking correct on screen.
// Converting in both directions is the only way the number a teacher typed is the number a student sees.

// Local input value -> UTC ISO string for the API. `new Date("2026-08-20T23:59")` is parsed as *local*
// time by definition, so toISOString() does the offset arithmetic.
export function dateTimeLocalToUtcIso(value: string): string {
  return new Date(value).toISOString();
}

// UTC ISO from the API -> local input value. Built from the local getters rather than by slicing
// toISOString(), which would show UTC and silently move the displayed time.
export function utcIsoToDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
