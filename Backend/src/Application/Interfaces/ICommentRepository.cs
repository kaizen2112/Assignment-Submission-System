using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Interfaces;

public interface ICommentRepository
{
    // The whole thread for one assignment, two levels deep, oldest first, with each comment's upvote
    // count and whether `readerId` is among the voters.
    //
    // Two levels is a fact about the rows, not a restriction on the conversation: a reply to a reply is
    // stored as another reply to the same top-level comment, carrying ReplyToCommentId. So this stays one
    // flat non-recursive query however deep the discussion goes.
    //
    // On which deleted rows come back — the spec asked for two things that cannot both hold:
    // "no IsDeleted rows" and "deletion keeps the replies, showing a 'Comment deleted' placeholder".
    // Dropping every deleted row would take a deleted parent's replies down with it, which is exactly
    // what the soft delete exists to prevent. So the rule is:
    //
    //   deleted reply                        -> omitted (nothing hangs off it)
    //   deleted parent with no live replies   -> omitted (same)
    //   deleted parent with live replies      -> returned, so the placeholder can hold its children
    //
    // The tombstone is the narrowest case that keeps other people's words reachable.
    //
    // readerId is a parameter rather than read from ICurrentUserService inside the repository, because
    // HasUpvoted is per-caller and a repository that reaches for ambient identity cannot be reasoned
    // about from its signature.
    Task<IReadOnlyList<CommentThreadRow>> GetForAssignmentAsync(
        Guid assignmentId,
        Guid readerId,
        CancellationToken cancellationToken = default);

    // Unscoped by design: the caller decides whether this comment may be read or deleted. Used by the
    // delete path (which needs AuthorId) and by the reply path (which must confirm the proposed target
    // belongs to the same assignment, and reads its ParentCommentId to find the root to attach to).
    Task<Comment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);

    // There is deliberately no SoftDeleteAsync here, though the spec sketched one.
    //
    // A repository method that both flipped IsDeleted and saved would put a domain transition behind the
    // mock in every unit test — the service would call it, the mock would do nothing, and no test could
    // observe that the comment was actually marked deleted. That is the same blind spot the rest of this
    // suite is careful to avoid.
    //
    // So deletion follows the pattern every other service already uses: the service calls
    // Comment.SoftDelete() and then SaveChangesAsync, exactly as SubmissionService calls
    // Submission.Grade() and then saves.

    // Insert-or-remove, returning the resulting state rather than void — the caller always needs the
    // new count, and computing it separately would mean a second round trip that could disagree.
    Task<UpvoteState> ToggleUpvoteAsync(
        Guid commentId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}

// A flat row of the thread read. Flat rather than the Comment entity with its Replies navigation
// populated, because the counts and the per-reader flag are computed in SQL and do not belong on the
// entity — hanging them there would mean a Comment loaded through any other path has meaningless
// zeroes on it. The service assembles the tree from these.
public sealed record CommentThreadRow(
    Guid Id,
    string Content,
    Guid AuthorId,
    string AuthorName,
    Guid? ParentCommentId,
    bool IsDeleted,
    DateTime CreatedAt,
    int UpvoteCount,
    bool HasUpvoted,
    // The addressed comment, for the @mention on a reply to a reply. Its name and its deleted flag are
    // both carried so the service can apply the same withholding rule it applies to AuthorName — the
    // decision of what a tombstone discloses lives in one place, not half here and half in SQL.
    Guid? ReplyToCommentId = null,
    string? ReplyToAuthorName = null,
    bool ReplyToIsDeleted = false);

public sealed record UpvoteState(int UpvoteCount, bool HasUpvoted);
