import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The container every distinct block of content sits in. Nothing floats directly on the gray-50 page
// background — that contrast between white card and gray ground is the only thing creating depth, so
// breaking it in one place makes that place look broken rather than minimal.
//
// Server components. A card is a box; the interactive things live inside it.

// Exported so an element Card cannot usefully wrap — a <form> that needs onSubmit, a <label> — can still
// be the same box without a redundant div around it.
// Dark mode inverts the depth trick rather than abandoning it: the page ground drops to gray-900 and the
// card rises to gray-800, so the card is still the lighter of the two and still reads as sitting on top.
// The border goes to gray-700 because a hairline lighter than the card would outline it instead.
export const CARD_CLASS =
  "rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800";

export function Card({
  className,
  children,
  as: Tag = "div",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  className?: string;
  children: ReactNode;
  // Lets a caller render the same visual box as a <section> or an <article> without a wrapper div, so
  // the DOM stays as flat as the design looks.
  as?: "div" | "section" | "article" | "aside";
  // A landmark element with no accessible name is a landmark a screen reader cannot list usefully, so
  // `as="section"` callers need a way to name it.
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={cn(CARD_CLASS, className)} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {children}
    </Tag>
  );
}

// An interactive card — a whole tile that navigates. Lifts on hover so the cursor change is not the
// only signal that it is clickable.
export function CardLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        CARD_CLASS,
        "p-5",
        "transition-all duration-200 hover:border-gray-200 hover:shadow-md dark:hover:border-gray-600",
        className,
      )}
    >
      {children}
    </div>
  );
}

// The small uppercase label that heads a section inside a card. 12px, tracked out, gray-400: it is a
// signpost, not a heading competing with the page title.
export function CardLabel({
  className,
  children,
  as: Tag = "h3",
}: {
  className?: string;
  children: ReactNode;
  as?: "h2" | "h3" | "p";
}) {
  return (
    <Tag
      className={cn(
        "text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// A card's own header strip, separated by a hairline rather than a shadow.
export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-b border-gray-100 px-6 py-4 dark:border-gray-700", className)}>
      {children}
    </div>
  );
}

// A group of form fields in a card, with an uppercase label as its header. Every form in the app is one
// or more of these, so the spacing between fields is decided once here rather than by whichever gap
// value each page happened to pick.
export function FormCard({
  label,
  description,
  className,
  children,
}: {
  label?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      {label && (
        <CardHeader>
          <CardLabel as="h2">{label}</CardLabel>
          {description && (
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </CardHeader>
      )}

      <div className="flex flex-col gap-5 p-6">{children}</div>
    </Card>
  );
}

// The button row at the foot of a form. Outside the card on purpose: the actions belong to the form as a
// whole, and putting them inside the last card makes them look like they belong to that section only.
export function FormActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}
