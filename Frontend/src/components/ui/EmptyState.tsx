import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  // Say why it is empty and what to do next. "No assignments yet" alone leaves a teacher wondering
  // whether the page is broken.
  description?: string;
  // A Lucide element. Defaults to an inbox, which reads as "nothing here yet" rather than as an error.
  icon?: ReactNode;
  action?: ReactNode;
  // Set when this sits inside a card that already has its own border, so the dashed outline is dropped
  // instead of drawing a box inside a box.
  bare?: boolean;
}

// An empty list is a successful result, not an error — the API returns items: [] with totalCount: 0
// and a 200. This component is what that 200 looks like.
export function EmptyState({
  title,
  description,
  icon,
  action,
  bare = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-14 text-center",
        // The dashed border stays dashed in dark mode — it is what says "this box is waiting for
        // content" rather than "this box is content", and that reading is theme-independent.
        !bare &&
          "rounded-xl border border-dashed border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 dark:bg-gray-700 dark:text-gray-500 [&>svg]:size-6"
      >
        {icon ?? <Inbox />}
      </span>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
