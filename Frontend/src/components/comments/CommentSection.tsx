"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Section } from "@/components/ui/Section";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { CommentCard } from "@/components/comments/CommentCard";
import { CommentInput } from "@/components/comments/CommentInput";
import { useSession } from "@/components/layout/SessionContext";
import { ApiError } from "@/lib/api";
import {
  createComment,
  deleteComment,
  listComments,
  replyToComment,
  toggleCommentUpvote,
} from "@/lib/comments";
import type { Comment } from "@/types/api";

// The thread, and the single owner of its state.
//
// It does NOT use useAsync, unlike every other loading page here, and the reason is worth stating: this
// component has to *mutate* what it loaded — every action updates the thread in place rather than
// refetching. useAsync hands back immutable data, and copying that into local state would need a
// setState in an effect body, which the React Compiler lint rule forbids. So the fetch lives here, with
// setState in the promise callback — exactly the shape useAsync itself uses internally.
export function CommentSection({ assignmentId }: { assignmentId: string }) {
  const profile = useSession();

  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    listComments(assignmentId, controller.signal)
      .then((loaded) => {
        // An abort is a navigation, not a failure — and writing state here would clobber a newer load.
        if (controller.signal.aborted) return;
        setComments(loaded);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof ApiError ? caught.message : "Comments could not be loaded.",
        );
      });

    return () => controller.abort();
  }, [assignmentId]);

  // Applies a change to one comment wherever it sits in the two-level tree. One helper, so a reply and
  // a top-level comment cannot end up with two different update paths that drift.
  const patchComment = useCallback(
    (commentId: string, patch: (comment: Comment) => Comment) => {
      setComments((current) =>
        current?.map((top) =>
          top.id === commentId
            ? patch(top)
            : { ...top, replies: top.replies.map((r) => (r.id === commentId ? patch(r) : r)) },
        ) ?? current,
      );
    },
    [],
  );

  // The one genuinely optimistic action. An upvote is a rapid, repeatable click, and waiting ~100ms for
  // a round trip before the icon fills makes the button feel broken — so the state flips now and the
  // server's answer reconciles it. On failure the flip is undone rather than left lying.
  const handleToggleUpvote = useCallback(
    (commentId: string) => {
      patchComment(commentId, (c) => ({
        ...c,
        hasUpvoted: !c.hasUpvoted,
        upvoteCount: c.upvoteCount + (c.hasUpvoted ? -1 : 1),
      }));

      void toggleCommentUpvote(assignmentId, commentId)
        .then((result) => {
          // The server is the authority on the count — another reader may have voted since this page
          // loaded, so the guess is replaced rather than trusted.
          patchComment(commentId, (c) => ({
            ...c,
            hasUpvoted: result.hasUpvoted,
            upvoteCount: result.upvoteCount,
          }));
        })
        .catch((caught: unknown) => {
          patchComment(commentId, (c) => ({
            ...c,
            hasUpvoted: !c.hasUpvoted,
            upvoteCount: c.upvoteCount + (c.hasUpvoted ? -1 : 1),
          }));
          setActionError(
            caught instanceof ApiError ? caught.message : "That vote could not be saved.",
          );
        });
    },
    [assignmentId, patchComment],
  );

  // Appends the row the server actually created rather than a locally invented one. Still no refetch —
  // which is the point — but the id, timestamp and author name are the real ones, so nothing has to be
  // reconciled afterwards and no temporary key can leak into the DOM.
  const handleCreate = useCallback(
    async (content: string) => {
      setActionError(null);
      try {
        const created = await createComment(assignmentId, { content });
        setComments((current) => [...(current ?? []), created]);
      } catch (caught) {
        setActionError(
          caught instanceof ApiError ? caught.message : "That comment could not be posted.",
        );
        // Rethrown so CommentInput keeps the draft text instead of clearing it.
        throw caught;
      }
    },
    [assignmentId],
  );

  // targetId is whoever was answered, which may itself be a reply — so the new row does not necessarily
  // belong to a thread keyed by that id. The server has already resolved it onto the right top-level
  // comment; this finds the same thread by asking which top-level comment contains the target, which is
  // how the reply lands in the correct place without a refetch.
  const handleReply = useCallback(
    async (targetId: string, content: string) => {
      setActionError(null);
      try {
        const created = await replyToComment(assignmentId, targetId, { content });
        setComments((current) =>
          current?.map((top) =>
            top.id === targetId || top.replies.some((reply) => reply.id === targetId)
              ? { ...top, replies: [...top.replies, created] }
              : top,
          ) ?? current,
        );
      } catch (caught) {
        setActionError(
          caught instanceof ApiError ? caught.message : "That reply could not be posted.",
        );
        throw caught;
      }
    },
    [assignmentId],
  );

  // Mirrors the server's soft-delete semantics rather than just dropping the row, so the optimistic
  // result matches what a refresh would show:
  //
  //   a reply, or a top-level comment with no replies -> gone
  //   a top-level comment that still has replies      -> a tombstone holding its children
  //
  // Getting this wrong is how an optimistic UI drifts from the truth: removing a parent outright would
  // take other people's replies off the screen, and they would reappear on the next page load.
  const handleDelete = useCallback(
    async (commentId: string) => {
      setActionError(null);

      const previous = comments;

      setComments((current) =>
        current
          ?.map((top) =>
            top.id === commentId
              ? { ...top, isDeleted: true, content: "", authorName: "" }
              : { ...top, replies: top.replies.filter((r) => r.id !== commentId) },
          )
          .filter((top) => !(top.id === commentId && top.replies.length === 0)) ?? current,
      );

      try {
        await deleteComment(assignmentId, commentId);
      } catch (caught) {
        // Restore the whole previous thread. Reversing the individual edit is not enough — a removed
        // reply would have to be put back at its original index, and the snapshot already knows it.
        setComments(previous);
        setActionError(
          caught instanceof ApiError ? caught.message : "That comment could not be deleted.",
        );
      }
    },
    [assignmentId, comments],
  );

  // An admin reads the thread but cannot post to it (A6), so they get no input box. The API would
  // refuse the POST with a 403 — drawing the control would be advertising a guaranteed failure.
  const canPost = profile !== null && profile.role !== "Admin";

  const totalCount =
    comments?.reduce((sum, c) => sum + 1 + c.replies.length, 0) ?? 0;

  return (
    <Section
      title="Discussion"
      icon={<MessageCircle />}
      description="Ask about the requirements, or answer someone else's question."
    >
      {error && <Alert className="mb-5">{error}</Alert>}
      {actionError && <Alert className="mb-5">{actionError}</Alert>}

      {comments === null && !error ? (
        // A skeleton shaped like two comments, so the panel does not jump when the thread lands.
        <SkeletonRegion label="Loading comments" className="flex flex-col gap-5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <div className="flex flex-col gap-5">
          {comments !== null && comments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-linear-to-br from-indigo-50 to-indigo-100/60 text-indigo-400 dark:from-indigo-500/15 dark:to-indigo-500/5 dark:text-indigo-300 [&>svg]:size-6"
              >
                <MessageCircle />
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  No comments yet
                </p>
                <p className="mx-auto max-w-sm text-[0.9375rem] text-gray-500 dark:text-gray-300">
                  {canPost
                    ? "Be the first to ask a question about this assignment."
                    : "Nobody has posted about this assignment yet."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p
                aria-live="polite"
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400"
              >
                <span className="tabular-nums">{totalCount}</span>{" "}
                {totalCount === 1 ? "comment" : "comments"}
              </p>

              {/* gap-4, not gap-5: each top-level comment now draws its own card, and the padding inside
                  it is already doing part of the separating that the gap used to do alone. */}
              <div className="flex flex-col gap-4">
                {comments?.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    assignmentId={assignmentId}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onToggleUpvote={handleToggleUpvote}
                  />
                ))}
              </div>
            </>
          )}

          {canPost && (
            // A hairline that fades at both ends rather than a full-width border. The rule is there to
            // separate the composer from the thread, and one that stops short of the edges does that
            // without drawing a second box around the panel it already sits in.
            <div className="pt-1">
              <div
                aria-hidden="true"
                className="h-px bg-linear-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700"
              />
              <div className="pt-5">
                <CommentInput onSubmit={handleCreate} />
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
