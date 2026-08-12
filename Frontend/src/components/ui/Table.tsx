import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";

// Server components — a table of text has no interactivity of its own; the buttons inside its cells are
// their own client components.
//
// These exist so no two tables in the app can drift apart on padding, borders and header styling. Two
// load-bearing details:
//
//  1. The horizontal scroll wrapper. A table is the one thing that reliably breaks a responsive layout,
//     and it must scroll inside its own box rather than making the whole page scroll sideways.
//  2. `group` on every row. That is what lets the last column's actions stay hidden until hover without
//     each table re-inventing the mechanism — see RowActions in IconButton.tsx.
//
// No zebra striping. The hover state carries row separation, and stripes plus hover is two competing
// systems for the same job.

export function TableWrap({
  children,
  // Set when the table already sits inside a Section or Card. Without it the table draws a second card
  // border a pixel inside the first one, which looks like a rendering bug rather than a nested panel.
  bare = false,
  className,
}: {
  children: ReactNode;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto",
        bare ? "border-t border-gray-100" : "rounded-xl border border-gray-100 bg-white shadow-sm",
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-gray-100 bg-gray-50">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function TR({
  children,
  // Off for skeleton and non-interactive rows: a hover highlight on a row that does nothing is a
  // promise the table does not keep.
  hover = true,
  className,
}: {
  children: ReactNode;
  hover?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "group",
        hover && "transition-colors duration-150 hover:bg-gray-50",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      // scope="col" is what tells a screen reader this cell heads its column.
      scope="col"
      className={cn(
        "h-10 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wider text-gray-500",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      // h-14 on the cell rather than the row: a <tr> ignores height, so the row's 56px comes from its
      // tallest cell.
      className={cn(
        "h-14 px-4 align-middle text-gray-600",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

// The first cell of a row — the thing the row is about. Darker and heavier than the data beside it, so
// scanning down the table reads as a list of names rather than a grid of equal text.
export function TDPrimary({ children, className }: { children: ReactNode; className?: string }) {
  return <TD className={cn("font-medium text-gray-900", className)}>{children}</TD>;
}

// Placeholder rows while a page loads, sized to the real column count so the layout does not jump when
// the data arrives. Preferred over a bare "Loading…" for tables: it shows the shape of what is coming.
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <TBody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TR key={rowIndex} hover={false}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TD key={columnIndex}>
              {/* Varied widths, so the block reads as text rather than as a loading bar chart. The
                  first column is widest because it holds the row's title. */}
              <Skeleton
                className={cn(
                  "h-3",
                  columnIndex === 0 ? "w-40" : columnIndex === columns - 1 ? "w-12" : "w-24",
                )}
              />
            </TD>
          ))}
        </TR>
      ))}
    </TBody>
  );
}

// An empty result inside a table that is already rendered — used where the header is worth keeping so the
// reader can still see what the columns would have been.
export function TableEmpty({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <TBody>
      <TR hover={false}>
        <td colSpan={columns} className="px-4 py-12 text-center">
          {children}
        </td>
      </TR>
    </TBody>
  );
}
