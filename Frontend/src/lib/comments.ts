import { api } from "@/lib/api";
import type { Comment, CreateCommentRequest, UpvoteResult } from "@/types/api";

// One place that knows the comment URLs, same as lib/assignments.ts. Every route is nested under the
// assignment, because the API authorizes against it — there is no way to reach a comment without
// naming the assignment it belongs to, and that is deliberate.

// Not paginated, unlike every other list in the app: a thread is read whole, and paging it would split
// replies from their parents.
export const listComments = (assignmentId: string, signal?: AbortSignal) =>
  api.get<Comment[]>(`/assignments/${assignmentId}/comments`, undefined, signal);

export const createComment = (assignmentId: string, body: CreateCommentRequest) =>
  api.post<Comment>(`/assignments/${assignmentId}/comments`, body);

// commentId is whoever is being answered, which may itself be a reply — the server attaches the row to
// that reply's own parent and records the addressee, so the client never has to work out where a reply
// belongs. What comes back is already in its final shape, mention included.
export const replyToComment = (
  assignmentId: string,
  commentId: string,
  body: CreateCommentRequest,
) => api.post<Comment>(`/assignments/${assignmentId}/comments/${commentId}/replies`, body);

// 204 on success, so there is no body to type.
export const deleteComment = (assignmentId: string, commentId: string) =>
  api.delete(`/assignments/${assignmentId}/comments/${commentId}`);

// POST rather than PUT: the caller asks to flip whichever state it is in, so two rapid clicks net out
// instead of racing to the same value.
export const toggleCommentUpvote = (assignmentId: string, commentId: string) =>
  api.post<UpvoteResult>(`/assignments/${assignmentId}/comments/${commentId}/upvote`);
