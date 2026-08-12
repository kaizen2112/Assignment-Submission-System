import { BarChart3, Percent, Trophy, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Highest, average, lowest and pass rate across the graded submissions on screen.
//
// No backend involved: every figure is derived from submission rows the page has already fetched, so this
// adds no request. What that also means is that it describes **the submissions currently loaded**, which is
// one page of them — the caller passes `truncated` when there are more, and the caption says so rather than
// implying it covered the whole class. A "Highest: 85" that omits a 92 on page 2 is wrong in a way a count is
// not.
export interface MarksStats {
  highest: number;
  lowest: number;
  average: number;
  passRate: number;
  gradedCount: number;
}

type Tone = "green" | "blue" | "red" | "purple";

// Written out rather than composed from a template string, because Tailwind scans source text: a class built
// as `bg-${tone}-50` is never emitted into the stylesheet and silently renders unstyled.
const TONES: Record<Tone, string> = {
  green: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
};

function Chip({
  tone,
  icon,
  value,
  label,
}: {
  tone: Tone;
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
        TONES[tone],
      )}
    >
      <span aria-hidden="true" className="[&>svg]:size-4 shrink-0">
        {icon}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

export function MarksDistribution({
  stats,
  maxMarks,
  truncated = false,
}: {
  stats: MarksStats;
  maxMarks: number;
  // True when the submissions table is showing one page of several, so these figures cover a subset.
  truncated?: boolean;
}) {
  return (
    <section aria-label="Marks distribution" className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          tone="green"
          icon={<Trophy />}
          value={`${stats.highest} / ${maxMarks}`}
          label="Highest"
        />
        <Chip
          tone="blue"
          icon={<BarChart3 />}
          value={`${stats.average} / ${maxMarks}`}
          label="Average"
        />
        <Chip
          tone="red"
          icon={<TrendingDown />}
          value={`${stats.lowest} / ${maxMarks}`}
          label="Lowest"
        />
        {/* Pass is marks >= 50% of the maximum. That threshold is this panel's own convention and nothing
            in the domain enforces it — no rule in the system defines a pass — so the label says what it
            measured rather than asserting an official grade boundary. */}
        <Chip
          tone="purple"
          icon={<Percent />}
          value={`${stats.passRate}%`}
          label={`Passed (≥ ${maxMarks / 2})`}
        />
      </div>

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Across <span className="tabular-nums">{stats.gradedCount}</span> graded submission
        {stats.gradedCount === 1 ? "" : "s"}
        {truncated ? " on this page" : ""}.
      </p>
    </section>
  );
}
