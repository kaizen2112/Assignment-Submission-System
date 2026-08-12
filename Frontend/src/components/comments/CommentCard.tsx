"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare, ThumbsUp, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { useSession } from "@/components/layout/SessionContext";
import { CommentInput } from "@/components/comments/CommentInput";
import { ReplyList } from "@/components/comments/ReplyList";
import { cn, formatRelative } from "@/lib/utils";
import type { Comment } from "@/types/api";

// A top-level comment gets a raised surface; a reply does not. Nesting a bordered box inside a bordered
// box reads as two unrelated things rather than one conversation, so the reply's place in the thread is
// carried by the rail in ReplyList instead. The gradient is a single stop of lift, not a colour effect —
// enough to separate the card from the panel behind it without competing with the text.
const TOP_LEVEL_SURFACE =
  "rounded-xl border border-gray-200/80 bg-linear-to-br from-white via-white to-gray-50 p-4 " +
  "shadow-sm transition-shadow duration-150 hover:shadow-md " +
  "dark:border-gray-700/80 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/70";

// Shared by every action in the row, so the upvote, reply and collapse controls cannot drift apart on
// size or spacing. 13px rather than 12px: these are real controls, not captions.
const ACTION_BASE =
  "pressable inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.8125rem] font-medium " +
  "active:scale-[0.94]";

const ACTION_QUIET =
  "text-gray-500 hover:bg-gray-100 hover:text-gray-900 " +
  "dark:text-gray-400 dark:hover:bg-gray-700/70 dark:hover:text-gray-100";

// One comment, plus its replies.
//
// Every action is a callback rather than a fetch: CommentSection owns the thread state and this stays a
// rendering component. That is what makes the optimistic updates coherent — one place applies them, so
// two cards cannot disagree about what the thread looks like.
export function CommentCard({
  comment,
  assignmentId,
  onReply,
  onDelete,
  onToggleUpvote,
  // Set for a reply, which is rendered by ReplyList. It changes how the comment is *drawn* — no surface,
  // smaller avatar — and nothing about what it can do: a reply can be replied to like anything else.
  isReply = false,
}: {
  comment: Comment;
  assignmentId: string;
  onReply: (targetId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onToggleUpvote: (commentId: string) => void;
  isReply?: boolean;
}) {
  const profile = useSession();
  const [replying, setReplying] = useState(false);

  // Collapsed by default once a thread gets long enough to push the next comment off screen. Two or
  // fewer replies are shown outright — hiding them behind a toggle would be more clicks than content.
  const [expanded, setExpanded] = useState(comment.replies.length <= 2);

  // Author-or-teacher, mirroring CommentService.DeleteAsync. The server decides; this only decides
  // whether to draw a button that would succeed. Note `profile` is null until /auth/me lands, so the
  // control simply is not rendered on that first frame rather than flickering.
  const canDelete =
    !comment.isDeleted &&
    profile !== null &&
    (profile.id === comment.authorId || profile.role === "Teacher");

  // A tombstone has no author, no content and no actions — the server sent none of them. It exists so
  // its replies keep their place in the thread.
  if (comment.isDeleted) {
    return (
      <div className={cn("flex items-start gap-3", !isReply && TOP_LEVEL_SURFACE)}>
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700",
            isReply ? "size-7" : "size-8",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] italic text-gray-400 dark:text-gray-500">Comment deleted</p>

          {comment.replies.length > 0 && (
            <ReplyList
              replies={comment.replies}
              assignmentId={assignmentId}
              onReply={onReply}
              onDelete={onDelete}
              onToggleUpvote={onToggleUpvote}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    // Two handles, and they are not the same thing. `id` is the anchor a mention on another reply links
    // to — scroll-mt keeps the landing spot clear of the sticky header. data-comment-id is for tests: a
    // comment card has no visible text guaranteed to be unique, so without it a browser test has to match
    // content and walk up the DOM, which picks the wrong card as soon as two comments share a word.
    <div
      id={`comment-${comment.id}`}
      data-comment-id={comment.id}
      className={cn(
        "group/comment scroll-mt-24 flex items-start gap-3",
        !isReply && TOP_LEVEL_SURFACE,
      )}
    >
      <Avatar fullName={comment.authorName} size={isReply ? "sm" : "md"} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[0.9375rem] font-semibold text-gray-900 dark:text-white">
            {comment.authorName}
          </span>
          {/* <time> with the ISO string in dateTime: the visible text is relative ("2 hours ago"), so
              the exact instant would otherwise be unavailable to a screen reader or a crawler. */}
          <time
            dateTime={comment.createdAt}
            title={new Date(comment.createdAt).toLocaleString()}
            className="text-xs text-gray-400 dark:text-gray-400"
          >
            {formatRelative(comment.createdAt)}
          </time>
        </div>

        {/* whitespace-pre-wrap keeps the writer's line breaks; wrap-break-word stops a pasted URL from
            widening the card past the page. Rendered as text, never as HTML. */}
        <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-[0.9375rem] leading-relaxed text-gray-700 dark:text-gray-200">
          {/* The @mention, present only on a reply that answered another reply. It stands in for the
              indent that flattening removed, so it has to read as addressed-to rather than as decoration —
              hence a filled chip and a link to the comment being answered. That target is always a sibling
              in this same list, so the jump can never land on something hidden. */}
          {comment.replyToAuthorName && (
            <>
              <a
                href={`#comment-${comment.replyToCommentId}`}
                className="mr-1 rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700 no-underline transition-colors duration-150 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25 dark:hover:text-indigo-200"
              >
                @{comment.replyToAuthorName}
              </a>{" "}
            </>
          )}
          {comment.content}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleUpvote(comment.id)}
            // aria-pressed is what conveys the on/off state; the fill is only the visual half of it.
            aria-pressed={comment.hasUpvoted}
            aria-label={comment.hasUpvoted ? "Remove upvote" : "Upvote"}
            className={cn(
              ACTION_BASE,
              comment.hasUpvoted
                ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30"
                : ACTION_QUIET,
            )}
          >
            <ThumbsUp
              aria-hidden="true"
              className={cn("size-4 shrink-0", comment.hasUpvoted && "fill-current")}
            />
            {/* tabular-nums so the label does not shift sideways as the count crosses 9. */}
            <span className="tabular-nums">{comment.upvoteCount}</span>
          </button>

          {/* Offered on replies too. Answering a reply does not nest it — the API attaches it to the same
              top-level comment and records the addressee, which this renders as the @mention above. */}
          <button
            type="button"
            onClick={() => setReplying((open) => !open)}
            aria-expanded={replying}
            className={cn(ACTION_BASE, ACTION_QUIET)}
          >
            <MessageSquare aria-hidden="true" className="size-4 shrink-0" />
            Reply
          </button>

          {canDelete && (
            // opacity-60 rather than 0: a control that is completely invisible until hover does not exist
            // at all on a touch screen, where there is no hover to reveal it.
            <IconButton
              label="Delete comment"
              icon={<Trash2 />}
              tone="danger"
              className="size-7 opacity-60 transition-opacity duration-150 group-hover/comment:opacity-100 focus-visible:opacity-100"
              onClick={() => void onDelete(comment.id)}
            />
          )}
        </div>

        {replying && (
          <div className="mt-3">
            <CommentInput
              autoFocus
              placeholder={`Reply to ${comment.authorName}…`}
              // "Post reply", not "Reply" — the toggle above is already called Reply, and two controls
              // in one card sharing an accessible name is ambiguous to anyone navigating by name rather
              // than by sight. The verb also distinguishes them: one opens the box, one sends it.
              submitLabel="Post reply"
              onCancel={() => setReplying(false)}
              onSubmit={async (content) => {
                await onReply(comment.id, content);
                // Closed only on success — a failed reply keeps the box and its text.
                setReplying(false);
              }}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className={cn(
                ACTION_BASE,
                "mt-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
                "dark:text-indigo-400 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300",
              )}
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              )}
              {expanded ? "Hide" : `Show ${comment.replies.length}`}{" "}
              {comment.replies.length === 1 ? "reply" : "replies"}
            </button>

            {expanded && (
              <ReplyList
                replies={comment.replies}
                assignmentId={assignmentId}
                onReply={onReply}
                onDelete={onDelete}
                onToggleUpvote={onToggleUpvote}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
