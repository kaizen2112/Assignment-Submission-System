import { cn } from "@/lib/utils";
import type { CompletionStats } from "@/types/api";

// How much of a class has handed an assignment in, in two densities: a line of text for a table cell and a
// bar for a page header. Both live here so the two can never disagree about how the same number reads.
//
// Whole percent in both, though the API sends one decimal. 66.7% and 67% carry the same meaning to somebody
// deciding whether to chase the class, and the extra digit costs a character in a column that is already
// narrow. The precise value stays in the payload for anything that needs it.
const asPercent = (stats: CompletionStats) => Math.round(stats.percentage);

// An em dash, not "0%". A class with nobody enrolled has no completion to report, and "0%" would read as a
// class that has ignored the assignment rather than one that has no students in it yet.
//
// `!stats` and not `stats !== null`, and the difference is not pedantry: the first version of this threw
// "Cannot read properties of undefined" against an API that did not send the field at all. The type says
// `| null`, but a type is a claim about the payload rather than a guarantee about it — an older server, a
// cached response or a partial write all deliver `undefined`, and the whole page then fails to render over
// one missing figure. Hence `undefined` in the signature too, saying out loud that absence is possible.
const isReportable = (stats: CompletionStats | null | undefined): stats is CompletionStats =>
  !!stats && stats.totalEnrolled > 0;

export function CompletionText({ stats }: { stats: CompletionStats | null | undefined }) {
  if (!isReportable(stats)) {
    return (
      <span aria-label="No enrolled students" className="text-gray-400 dark:text-gray-500">
        —
      </span>
    );
  }

  // Stacked, with the percentage on top.
  //
  // The brief asked for the fraction first and the percentage below "in smaller text", but also for the
  // percentage to be the bold, larger, indigo one — which cannot both hold. Resolved in favour of the
  // explicit styling: the percentage is the summary a teacher scans down the column, so it leads, and a
  // large element sitting under a small one looks bottom-heavy anyway. The fraction stays underneath as the
  // detail that makes it meaningful — 67% of three students is a different situation from 67% of thirty.
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-base font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
        {asPercent(stats)}%
      </span>
      <span className="whitespace-nowrap text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {stats.totalSubmitted} / {stats.totalEnrolled} submitted
      </span>
    </span>
  );
}

export function CompletionBar({
  stats,
  className,
}: {
  stats: CompletionStats | null | undefined;
  className?: string;
}) {
  if (!isReportable(stats)) return null;

  const percent = asPercent(stats);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-3">
        {/* role="progressbar" with the aria-value* trio: the fill is a styled div, so without these a
            screen reader is told nothing at all. aria-valuetext carries the sentence rather than the bare
            number, since "67" on its own is not an answer to anything. */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${stats.totalSubmitted} of ${stats.totalEnrolled} students submitted`}
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 ease-out dark:bg-indigo-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
          {percent}%
        </span>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        <span className="tabular-nums">{stats.totalSubmitted}</span> of{" "}
        <span className="tabular-nums">{stats.totalEnrolled}</span> student
        {stats.totalEnrolled === 1 ? "" : "s"} submitted
      </p>
    </div>
  );
}
