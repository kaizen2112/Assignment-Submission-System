import { cn } from "@/lib/utils";
// The skeleton's whole job is to be the same shape and colour as the card it stands in for, so it reads
// the card's own class rather than restating it — a second copy would drift the moment one is themed.
import { CARD_CLASS } from "@/components/ui/Card";

// The one loading primitive. Everything that loads renders a skeleton shaped like the content that is
// coming, never a spinner or the word "Loading" — a placeholder that matches the real layout means the
// page does not jump when data lands, which is the actual complaint behind "it feels janky".
//
// Server components: a pulsing rectangle has no interactivity.
//
// aria-hidden throughout. A skeleton is decoration; the announcement belongs on the container that owns
// the fetch, which is why the wrappers below carry role="status" and a visually hidden label instead.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-gray-200 dark:bg-gray-700", className)}
    />
  );
}

// Wraps a group of skeletons so screen readers hear one "Loading" rather than nothing at all.
export function SkeletonRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Mirrors StatCard: an icon square plus two bars of text.
export function StatCardSkeleton() {
  return (
    <div className={cn(CARD_CLASS, "flex items-start gap-4 p-5")}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// Mirrors an assignment card on the student dashboard.
export function CardSkeleton() {
  return (
    <div className={cn(CARD_CLASS, "p-5")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-1 h-3 w-full" />
      <Skeleton className="mb-4 h-3 w-2/3" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// A block of lines, for a prose panel whose shape is not known in advance.
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          // The last line is short, the way a real paragraph ends mid-width.
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
