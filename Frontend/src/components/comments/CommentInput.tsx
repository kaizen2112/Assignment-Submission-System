"use client";

import { useId, useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { COMMENT_MAX_LENGTH } from "@/types/api";

// The write box, used for both a new top-level comment and an inline reply.
//
// It owns only the draft text. Whether the post succeeded, and what to do with the result, belongs to
// whoever rendered it — so `onSubmit` is async and this component clears itself only once that promise
// resolves. Clearing on click would throw away the text if the request failed.
export function CommentInput({
  onSubmit,
  onCancel,
  placeholder = "Add a comment…",
  submitLabel = "Comment",
  autoFocus = false,
}: {
  onSubmit: (content: string) => Promise<void>;
  // Present only for a reply, where dismissing the box is a real action. A top-level input is always
  // on screen and has nothing to cancel back to.
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = content.trim();
  const tooLong = content.length > COMMENT_MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      // Only on success. A failed post keeps the text so it can be retried rather than retyped.
      setContent("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>

      <textarea
        id={id}
        rows={3}
        value={content}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => setContent(event.target.value)}
        // Ctrl/Cmd+Enter submits. Plain Enter must stay a newline — a comment box that posts on Enter
        // makes multi-line replies impossible and fires on a stray keystroke.
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        // No maxLength attribute: it would silently swallow the keystroke that crosses the limit, so
        // the counter could never turn red and the writer would not know why typing stopped.
        className={cn(
          "w-full resize-y rounded-xl border px-3.5 py-3 text-[0.9375rem] leading-relaxed",
          "bg-white text-gray-900 placeholder:text-gray-400",
          "transition-shadow duration-150 focus:outline-none focus:ring-2",
          // Sunk slightly below the card it sits on rather than level with it, so the box reads as
          // somewhere to type. In dark mode that means going darker than the surface, not lighter.
          "shadow-inner dark:bg-gray-900/60 dark:text-gray-100 dark:placeholder:text-gray-400",
          tooLong
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
            : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-gray-600 dark:focus:border-indigo-400",
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "text-xs tabular-nums",
            tooLong ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-400",
          )}
        >
          {content.length} / {COMMENT_MAX_LENGTH}
        </span>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" size="sm" variant="ghost" icon={<X />} onClick={onCancel}>
              Cancel
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            icon={<Send />}
            disabled={!canSubmit}
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
