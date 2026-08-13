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
          // w-fit so the hit area stops at the words. Without it the inline-flex would still be a block
          // in some contexts and the link would swallow the empty width beside it.
          className="mb-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors duration-150 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      )}

      {crumbs && crumbs.length > 0 && (
        // The trail was gray-400 on gray-50 throughout — around 2.5:1, under the 4.5:1 body-text floor and
        // legible mostly to people who already knew what it said. It is now three weights instead of one
        // flat tone: the links are readable on their own, the current page is the darkest thing in the row,
        // and only the chevrons stay light, because a separator competing with the words it separates is
        // the one part of a breadcrumb that genuinely should recede.
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-gray-400 dark:text-gray-600"
                  />
                )}

                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    // Indigo on hover rather than a darker gray: this is the only cue that some crumbs are
                    // clickable and the last one is not, now that the two are no longer separated by tone
                    // alone.
                    className="rounded transition-colors duration-150 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  // aria-current marks the page you are on, which is the one thing a breadcrumb has to
                  // convey and colour alone cannot.
                  <span aria-current="page" className="font-semibold text-gray-900 dark:text-gray-100">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
