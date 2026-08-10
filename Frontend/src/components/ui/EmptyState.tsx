import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  // Say why it is empty and what to do next. "No assignments yet" alone leaves a teacher wondering
  // whether the page is broken.
  description?: string;
  action?: ReactNode;
}

// An empty list is a successful result, not an error — the API returns items: [] with totalCount: 0
// and a 200. This component is what that 200 looks like.
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>

      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
