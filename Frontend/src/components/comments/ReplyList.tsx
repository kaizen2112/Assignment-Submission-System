"use client";

import { CommentCard } from "@/components/comments/CommentCard";
import type { Comment } from "@/types/api";

// The second level. A separate component rather than a branch inside CommentCard because the rail down the
// left is a property of the *group* of replies, not of each one — drawing it per card would give one
// broken line per reply instead of one continuous thread.
//
// Every reply sits at this same depth, including one written in answer to another reply: the API stores
// such a reply against the same top-level comment and records who it addressed, so it arrives here as a
// sibling and says who it answers with an @mention. That is what keeps the text column the same width all
// the way down instead of narrowing with each exchange.
//
// isReply is passed down for appearance only — the cards inside drop their raised surface and take the
// smaller avatar. It does not remove their Reply button.
export function ReplyList({
  replies,
  assignmentId,
  onReply,
  onDelete,
  onToggleUpvote,
}: {
  replies: Comment[];
  assignmentId: string;
  onReply: (targetId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onToggleUpvote: (commentId: string) => void;
}) {
  if (replies.length === 0) return null;

  return (
    // The rail is a gradient on a pseudo-element rather than a border-left, so it can fade out at the
    // bottom: a hard line stopping dead below the last reply reads as a truncated list, while a fade reads
    // as the thread ending. A border cannot be given a gradient.
    <div
      className={[
        "relative mt-4 flex flex-col gap-4 pl-6",
        "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full",
        "before:content-[''] before:bg-linear-to-b",
        "before:from-indigo-300 before:via-indigo-200/70 before:to-transparent",
        "dark:before:from-indigo-400/70 dark:before:via-indigo-500/25",
      ].join(" ")}
    >
      {replies.map((reply) => (
        <CommentCard
          key={reply.id}
          comment={reply}
          assignmentId={assignmentId}
          onReply={onReply}
          onDelete={onDelete}
          onToggleUpvote={onToggleUpvote}
          isReply
        />
      ))}
    </div>
  );
}
