using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Comment;

namespace AssignmentSystem.Application.Interfaces;

public interface ICommentService
{
    // Threaded, two levels. Not paginated, unlike every list endpoint in the system: a comment thread is
    // read as a whole and paging it would split replies from their parents. The 1000-character cap plus
    // the per-assignment scope bounds the response; if a thread ever needed paging it would have to page
    // top-level comments and carry their replies along, which is a different query.
    Task<Result<IReadOnlyList<CommentResponse>>> GetForAssignmentAsync(
        Guid assignmentId,
        CancellationToken cancellationToken = default);

    Task<Result<CommentResponse>> AddAsync(
        Guid assignmentId,
        CreateCommentRequest request,
        CancellationToken cancellationToken = default);

    // targetCommentId is the comment being answered, which is not necessarily the comment this reply ends
    // up under: replying to a reply attaches to that reply's own parent and records the addressee, so the
    // thread stays two levels deep. The caller does not have to know that — it names who it is answering
    // and the service works out where the row belongs.
    Task<Result<CommentResponse>> AddReplyAsync(
        Guid assignmentId,
        Guid targetCommentId,
        CreateCommentRequest request,
        CancellationToken cancellationToken = default);

    // Result rather than Result<T>: there is nothing meaningful to hand back, and the client already
    // knows which row it asked to remove.
    Task<Result> DeleteAsync(
        Guid assignmentId,
        Guid commentId,
        CancellationToken cancellationToken = default);

    Task<Result<UpvoteResponse>> ToggleUpvoteAsync(
        Guid assignmentId,
        Guid commentId,
        CancellationToken cancellationToken = default);
}
