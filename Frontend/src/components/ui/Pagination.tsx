"use client";

import { Button } from "@/components/ui/Button";
import type { PagedResult } from "@/types/api";

interface PaginationProps {
  // Takes the whole envelope rather than loose numbers, so a caller cannot pass page and totalPages
  // from two different responses.
  result: Pick<PagedResult<unknown>, "page" | "pageSize" | "totalCount" | "totalPages">;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ result, onPageChange, disabled = false }: PaginationProps) {
  const { page, pageSize, totalCount, totalPages } = result;

  // One page or none: the controls would be decoration. An empty result renders EmptyState instead.
  if (totalPages <= 1) return null;

  const firstOnPage = (page - 1) * pageSize + 1;
  // The last page is usually partial, so this is the smaller of the arithmetic and the real total.
  const lastOnPage = Math.min(page * pageSize, totalCount);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3"
    >
      {/* aria-live so a screen reader announces the new range after the page changes. */}
      <p aria-live="polite" className="text-xs text-slate-600">
        Showing <span className="font-medium tabular-nums">{firstOnPage}</span>–
        <span className="font-medium tabular-nums">{lastOnPage}</span> of{" "}
        <span className="font-medium tabular-nums">{totalCount}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <span className="text-xs text-slate-600 tabular-nums">
          Page {page} of {totalPages}
        </span>

        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
