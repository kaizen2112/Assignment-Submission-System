import { Clock } from "lucide-react";
import { cn, daysUntil, deadlineUrgency, formatDate } from "@/lib/utils";

// A deadline, coloured by how much it matters right now. The urgency thresholds live in utils.ts so a
// card, a table cell and a detail page cannot disagree about when "soon" starts.
//
// Server component. `deadlineUrgency` reads the clock, which means this renders against server time on
// the first paint and client time thereafter — harmless here, because every page that uses it is inside a
// client component tree that has already fetched its own data.

export function DeadlineLabel({
  deadline,
  className,
}: {
  deadline: string;
  className?: string;
}) {
  const urgency = deadlineUrgency(deadline);

  if (urgency === "past") {
    // Struck through: the deadline is a fact about the past now, not an instruction. "Closed" says what
    // that means without the reader doing date arithmetic.
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-gray-400", className)}>
        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="line-through">{formatDate(deadline)}</span>
        <span className="font-medium">Closed</span>
      </span>
    );
  }

  if (urgency === "today" || urgency === "tomorrow") {
    // A pill, not just red text. These two are the only cases where the student has to act now, so they
    // get a shape as well as a colour.
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1",
          "text-xs font-medium text-red-600",
          className,
        )}
      >
        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
        Due {urgency === "today" ? "today" : "tomorrow"}
      </span>
    );
  }

  if (urgency === "soon") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-amber-600", className)}
      >
        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
        Due in {daysUntil(deadline)} days
      </span>
    );
  }

  // Distant: the date itself is more useful than a countdown nobody is counting.
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-gray-500", className)}>
      <Clock aria-hidden="true" className="size-3.5 shrink-0" />
      Due {formatDate(deadline)}
    </span>
  );
}
