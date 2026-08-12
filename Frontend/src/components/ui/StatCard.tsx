import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CARD_CLASS } from "@/components/ui/Card";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

// A server component — a number in a box has no interactivity.
//
// The icon sits in a tinted square rather than floating loose: it gives the card a fixed anchor point on
// the left so a row of cards scans as a row, however different the numbers are in width.

type StatTone = "accent" | "amber" | "green" | "blue" | "gray";

const TONES: Record<StatTone, string> = {
  accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  gray: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

interface StatCardProps {
  label: string;
  // null means "loaded, but this number could not be determined", which is different from 0 and from
  // still loading. Rendered as an em dash rather than a misleading zero.
  value: number | null;
  icon: ReactNode;
  tone?: StatTone;
  hint?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  tone = "gray",
  hint,
  loading = false,
}: StatCardProps) {
  // The skeleton is the same shape as the real card, so a dashboard does not reflow when the numbers
  // arrive.
  if (loading) return <StatCardSkeleton />;

  return (
    <div
      className={cn(
        CARD_CLASS,
        "flex items-start gap-4 p-5",
        // Lifts on hover. These cards are not clickable, so this is not a click affordance — it is the
        // dashboard acknowledging the cursor, which is the difference between a page that feels live and
        // a screenshot. `transition-all` is safe here because nothing about the card reflows.
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          "[&>svg]:size-5",
          TONES[tone],
        )}
      >
        {icon}
      </span>

      <div className="min-w-0">
        {/* tabular-nums so a row of these does not jitter as digits change width. */}
        <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {value === null ? "—" : value}
        </p>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}
