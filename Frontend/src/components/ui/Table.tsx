import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Server components — a table of text has no interactivity of its own; the buttons inside its cells are
// their own client components.
//
// These exist so the two teacher tables (and the student ones in Step 4) cannot drift apart on padding,
// borders and header styling. The horizontal scroll wrapper is the load-bearing part: a table is the one
// thing that reliably breaks a responsive layout, and it must scroll inside its own box rather than
// making the whole page scroll sideways.

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  // divide-y rather than a border on each row: no trailing border under the last row to cancel out.
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
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
        "whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500",
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
      className={cn(
        "px-3 py-2 align-middle text-slate-700",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

// Placeholder rows while a page loads, sized to the real column count so the layout does not jump when
// the data arrives. Preferred over a bare "Loading…" for tables: it shows the shape of what is coming.
export function TableSkeleton({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return (
    <TBody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TR key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TD key={columnIndex}>
              <div aria-hidden="true" className="h-4 w-full animate-pulse rounded bg-slate-200" />
            </TD>
          ))}
        </TR>
      ))}
    </TBody>
  );
}
