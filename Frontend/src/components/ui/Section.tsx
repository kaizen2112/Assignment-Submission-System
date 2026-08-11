import type { ReactNode } from "react";

// A titled panel. Server component — the interactive parts are the forms and tables inside it.
//
// Exists because the class management screen is three of these stacked (subjects, teachers, students)
// and they must not drift apart on spacing or heading level. h2, not h1: PageHeader owns the h1, and a
// page with four h1s is a page a screen reader cannot outline.
export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {children}
    </section>
  );
}
