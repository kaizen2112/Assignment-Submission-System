namespace AssignmentSystem.Application.DTOs.Comment;

// The read model for one comment in a thread.
//
// Two fields here are per-caller rather than per-row, and that is the whole reason this cannot be a
// projection of the entity alone:
//
//   HasUpvoted  — "did *you* vote for this", which differs for every reader
//   Content     — blanked when IsDeleted, so the placeholder text is decided server-side
//
// Serving the real content of a deleted comment and letting the UI decide whether to show it would put
// the text on the wire, where anyone can read it in the network tab. The blanking happens here instead.
public sealed record CommentResponse(
    Guid Id,
    string Content,
    Guid AuthorId,
    string AuthorName,
    DateTime CreatedAt,
    int UpvoteCount,
    bool HasUpvoted,
    bool IsDeleted,
    // Both null unless this is a reply to another reply. The client renders ReplyToAuthorName as an
    // @mention, which is what stands in for the indent that flattening removed; ReplyToCommentId is sent
    // alongside so the mention can be a link to the comment being answered rather than plain text.
    //
    // ReplyToAuthorName is blanked when the addressed comment has been deleted, for the same reason
    // AuthorName is: a tombstone is not a record of who was removed from the thread. The mention then
    // simply does not render.
    Guid? ReplyToCommentId,
    string? ReplyToAuthorName,
    // Always present, never null — an empty list for a comment with no replies, and always empty on a
    // reply itself, since the thread is two levels deep. A nullable collection would make every caller
    // write the same `?? []`.
    IReadOnlyList<CommentResponse> Replies);

public sealed record CreateCommentRequest(string Content);

// Returned by the toggle endpoint instead of the whole comment: the client already has the rest of the
// row rendered and only these two values can have changed. It also makes the optimistic update on the
// frontend verifiable — it can compare what it guessed against what came back.
public sealed record UpvoteResponse(int UpvoteCount, bool HasUpvoted);
