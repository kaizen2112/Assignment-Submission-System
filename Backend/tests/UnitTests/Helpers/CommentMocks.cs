using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using Moq;
using CommentEntity = AssignmentSystem.Domain.Entities.Comment;

namespace AssignmentSystem.UnitTests.Helpers;

// Comment-specific builders and mocks. A separate file from EntityBuilders/MockRepositoryHelper rather
// than additions to them, because this feature is additive and nothing that already passes should have
// to be re-read to trust it.
internal static class CommentMocks
{
    // Built through the real Comment.Create, like every other builder here — no reflection and no
    // test-only constructor, so a test cannot arrange a comment the application could not produce.
    internal static CommentEntity Comment(
        Guid assignmentId,
        User author,
        string content = "Test comment.",
        Guid? parentCommentId = null,
        bool deleted = false,
        Guid? replyToCommentId = null)
    {
        var comment = CommentEntity.Create(
            assignmentId, author.Id, content, parentCommentId, replyToCommentId);

        if (deleted)
        {
            comment.SoftDelete();
        }

        comment.Author = author;

        return comment;
    }

    internal static Mock<ICommentRepository> Comments() => new();

    // Matches on each comment's own id, so a lookup for any other id falls through to the mock's
    // default of null — which is exactly the not-found case.
    internal static Mock<ICommentRepository> CommentsWith(params CommentEntity[] comments)
    {
        var mock = new Mock<ICommentRepository>();

        foreach (var comment in comments)
        {
            mock.Setup(r => r.GetByIdAsync(comment.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(comment);
        }

        return mock;
    }

    // A *stateful* upvote fake, and the reason matters.
    //
    // A canned ReturnsAsync would make "toggle twice returns to the original state" a test of the
    // arrangement rather than of anything real — it would pass against a service that called the
    // repository once, twice, or not at all. Backing the mock with a set makes the second call actually
    // observe the first one's effect, so the assertion is about behaviour.
    //
    // The set mirrors what the unique index on (CommentId, UserId) guarantees in the database: one vote
    // per person per comment, so a repeat vote is a removal rather than a second row.
    internal static Mock<ICommentRepository> WithStatefulUpvotes(
        this Mock<ICommentRepository> mock,
        params (Guid CommentId, Guid UserId)[] existingVotes)
    {
        var votes = new HashSet<(Guid CommentId, Guid UserId)>(existingVotes);

        mock.Setup(r => r.ToggleUpvoteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid commentId, Guid userId, CancellationToken _) =>
            {
                var key = (commentId, userId);

                var nowVoted = votes.Add(key);
                if (!nowVoted)
                {
                    votes.Remove(key);
                }

                return new UpvoteState(
                    votes.Count(v => v.CommentId == commentId),
                    nowVoted);
            });

        return mock;
    }

    internal static Mock<ICommentRepository> WithThread(
        this Mock<ICommentRepository> mock,
        params CommentThreadRow[] rows)
    {
        mock.Setup(r => r.GetForAssignmentAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(rows);

        return mock;
    }

    internal static CommentThreadRow Row(
        CommentEntity comment,
        int upvoteCount = 0,
        bool hasUpvoted = false,
        // What the repository's join to the addressed comment would have found. Passed in rather than
        // derived from the entity, because the entity holds only the id — the name is on the *other* row's
        // author, and its deleted flag is that row's too. A test that wants a mention arranges both.
        string? replyToAuthorName = null,
        bool replyToIsDeleted = false) =>
        new(
            comment.Id,
            comment.Content,
            comment.AuthorId,
            comment.Author.FullName,
            comment.ParentCommentId,
            comment.IsDeleted,
            comment.CreatedAt,
            upvoteCount,
            hasUpvoted,
            comment.ReplyToCommentId,
            replyToAuthorName,
            replyToIsDeleted);
}
