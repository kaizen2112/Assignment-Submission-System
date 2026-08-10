import { cn } from "@/lib/utils";

// A server component — a number in a box has no interactivity.

interface StatCardProps {
  label: string;
  // null means "loaded, but this number could not be determined", which is different from 0 and from
  // still loading. Rendered as an em dash rather than a misleading zero.
  value: number | null;
  hint?: string;
  loading?: boolean;
  emphasis?: boolean;
}

export function StatCard({ label, value, hint, loading = false, emphasis = false }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4",
        emphasis ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>

      {loading ? (
        // A fixed-height bar, so the card does not resize when the real number arrives.
        <div
          aria-hidden="true"
          className="mt-2 h-8 w-12 animate-pulse rounded bg-slate-200"
        />
      ) : (
        // tabular-nums so a column of these does not jitter as digits change width.
        <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
          {value === null ? "—" : value}
        </p>
      )}

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
