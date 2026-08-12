import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A titled card. Server component — the interactive parts are the forms and tables inside it.
//
// Exists because the class management screen is three of these stacked (subjects, teachers, students) and
// they must not drift apart on spacing or heading level. h2, not h1: PageHeader owns the h1, and a page
// with four h1s is a page a screen reader cannot outline.
export function Section({
  title,
  description,
  icon,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  // A Lucide element, shown in a tinted square beside the title — the same anchor pattern as StatCard,
  // so a stack of sections has a consistent left edge.
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0 is load-bearing, not defensive. A grid or flex item defaults to `min-width: auto`, so it
    // refuses to shrink below its content's min-content width — which means a Section holding a table
    // pushes the whole page wider instead of letting the table's own overflow-x-auto scroll. Without
    // this, the teacher dashboard overflowed by 56px at 390px.
    <section
      className={cn("min-w-0 rounded-xl border border-gray-100 bg-white shadow-sm", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 [&>svg]:size-4"
            >
              {icon}
            </span>
          )}

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className={cn("px-6 pb-6", bodyClassName)}>{children}</div>
    </section>
  );
}

// The divider between a section's content and a form at its foot. Used where a panel both shows a list
// and offers a way to add to it.
export function SectionFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mt-5 border-t border-gray-100 pt-5", className)}>{children}</div>
  );
}
