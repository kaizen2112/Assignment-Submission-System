namespace AssignmentSystem.Domain.Entities;

// One person's upvote on one comment. A row's existence *is* the upvote, so there is no boolean to
// keep in sync and no "un-upvoted" state to represent — removing the vote removes the row.
//
// This is the one place in the system where a hard delete is right. A soft-deleted upvote would still
// have to be excluded from every count, which is the same work as deleting it with an extra column to
// forget about; and unlike a comment, a withdrawn vote leaves nothing behind that anyone can read.
public sealed class CommentUpvote
{
    private CommentUpvote() { }

    // A surrogate key rather than a composite (CommentId, UserId) primary key, matching
    // StudentEnrollment and TeacherAssignment. The pair is still unique — enforced by the index in
    // CommentUpvoteConfiguration, which is what makes a double-click a no-op instead of a second vote.
    public Guid Id { get; private set; }

    public Guid CommentId { get; private set; }

    public Comment Comment { get; internal set; } = null!;

    public Guid UserId { get; private set; }

    public User User { get; internal set; } = null!;

    public DateTime CreatedAt { get; private set; }

    public static CommentUpvote Create(Guid commentId, Guid userId)
    {
        return new CommentUpvote
        {
            Id = Guid.NewGuid(),
            CommentId = commentId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };
    }
}
