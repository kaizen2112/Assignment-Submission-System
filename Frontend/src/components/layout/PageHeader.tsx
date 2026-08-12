import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// One header pattern for every page: an optional trail above, the title at 24px, an optional line of
// description below, and an optional action on the right. Server component.
//
// The trail and the back link are two views of the same information, and which one a page wants depends
// on depth: a top-level list gets a trail for orientation, a detail page gets a back link because the
// reader has somewhere specific to return to. Passing both renders both — the back link first, since
// that is the one people click.

export interface Crumb {
  label: string;
  // Omit on the last crumb — the page you are already on is not a link.
  href?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  backHref,
  backLabel = "Back",
  crumbs,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
  crumbs?: Crumb[];
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors duration-150 hover:text-indigo-600"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      )}

      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-400">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-gray-300" />
                )}

                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="transition-colors duration-150 hover:text-gray-600"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  // aria-current marks the page you are on, which is the one thing a breadcrumb has to
                  // convey and colour alone cannot.
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
