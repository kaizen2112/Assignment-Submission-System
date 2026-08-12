using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Comment;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Application.Validators.Comment;
using AssignmentSystem.Domain.Enums;
using AssignmentEntity = AssignmentSystem.Domain.Entities.Assignment;
using CommentEntity = AssignmentSystem.Domain.Entities.Comment;

namespace AssignmentSystem.Application.Services;

// Comments on an assignment. Every path here starts by asking the same question the rest of the system
// already asks — "may this caller see this assignment at all?" — and answers it by calling the *existing*
// scoped queries rather than by writing a second set of visibility checks.
//
// That reuse is the whole security design. A student's access runs through
// IAssignmentRepository.GetPublishedForStudentAsync, which already encodes rules 3 and 6 in SQL, so a
// draft assignment has no comment thread and neither does one belonging to a class the student is not
// enrolled in. A teacher's runs through IClassRepository.TeacherAssignmentExistsAsync, which is rule 4.
// If comments had asked the question differently, they would have become a way around the answer.
public sealed class CommentService : ICommentService
{
    private const string AssignmentNotFound = "Assignment not found.";
    private const string CommentNotFound = "Comment not found.";
    private const string NotAssigned = "You are not assigned to this class and subject.";

    private readonly ICommentRepository _comments;
    private readonly IAssignmentRepository _assignments;
    private readonly IClassRepository _classes;
    private readonly IUserRepository _users;
    private readonly ICurrentUserService _currentUser;

    public CommentService(
        ICommentRepository comments,
        IAssignmentRepository assignments,
        IClassRepository classes,
        IUserRepository users,
        ICurrentUserService currentUser)
    {
        _comments = comments;
        _assignments = assignments;
        _classes = classes;
        _users = users;
        _currentUser = currentUser;
    }

    public async Task<Result<IReadOnlyList<CommentResponse>>> GetForAssignmentAsync(
        Guid assignmentId,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<IReadOnlyList<CommentResponse>>("Not authenticated.", ErrorType.Unauthorized);
        }

        var access = await AuthorizeOnAssignmentAsync(assignmentId, caller, cancellationToken);
        if (!access.IsSuccess)
        {
            return Fail<IReadOnlyList<CommentResponse>>(access.Error!, access.ErrorType);
        }

        var rows = await _comments.GetForAssignmentAsync(assignmentId, caller.UserId, cancellationToken);

        return Result<IReadOnlyList<CommentResponse>>.Success(BuildThread(rows));
    }

    public async Task<Result<CommentResponse>> AddAsync(
        Guid assignmentId,
        CreateCommentRequest request,
        CancellationToken cancellationToken = default) =>
        await AddInternalAsync(assignmentId, targetCommentId: null, request, cancellationToken);

    public async Task<Result<CommentResponse>> AddReplyAsync(
        Guid assignmentId,
        Guid targetCommentId,
        CreateCommentRequest request,
        CancellationToken cancellationToken = default) =>
        await AddInternalAsync(assignmentId, targetCommentId, request, cancellationToken);

    public async Task<Result> DeleteAsync(
        Guid assignmentId,
        Guid commentId,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        var access = await AuthorizeOnAssignmentAsync(assignmentId, caller, cancellationToken);
        if (!access.IsSuccess)
        {
            return Result.Failure(access.Error!, access.ErrorType);
        }

        var comment = await _comments.GetByIdAsync(commentId, cancellationToken);

        // Matched against the assignment in the route, the same guard SubmissionService.LoadForTeacherAsync
        // applies: a real comment id nested under the wrong assignment reads as absent, so the URL cannot
        // be edited into another assignment's thread.
        if (comment is null || comment.AssignmentId != assignmentId)
        {
            return Result.Failure(CommentNotFound, ErrorType.NotFound);
        }

        var isAuthor = comment.AuthorId == caller.UserId;

        // A teacher who holds this class+subject moderates the thread. AuthorizeOnAssignmentAsync has
        // already confirmed the grant for a Teacher caller, so reaching here as one means it held.
        //
        // Admin is deliberately absent from this list. The spec scopes deletion to "the author or the
        // teacher of that assignment's class+subject", and assumption A6 keeps admins out of coursework
        // actions — an admin holds no teaching scope, so moderating a subject thread is not their call.
        var isModerator = caller.Role == Role.Teacher;

        if (!isAuthor && !isModerator)
        {
            return Result.Failure(
                "You can only delete your own comments.", ErrorType.Forbidden);
        }

        // The transition happens here rather than inside the repository, matching every other service:
        // the entity decides what "deleted" means, the repository only persists it. That also keeps the
        // flag observable to a unit test, which a mocked repository method would not be.
        //
        // Idempotent: SoftDelete on an already-deleted comment is a no-op, so a double click is a 204
        // rather than a confusing failure.
        comment.SoftDelete();
        await _comments.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    public async Task<Result<UpvoteResponse>> ToggleUpvoteAsync(
        Guid assignmentId,
        Guid commentId,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<UpvoteResponse>("Not authenticated.", ErrorType.Unauthorized);
        }

        var access = await AuthorizeOnAssignmentAsync(assignmentId, caller, cancellationToken);
        if (!access.IsSuccess)
        {
            return Fail<UpvoteResponse>(access.Error!, access.ErrorType);
        }

        var comment = await _comments.GetByIdAsync(commentId, cancellationToken);

        if (comment is null || comment.AssignmentId != assignmentId)
        {
            return Fail<UpvoteResponse>(CommentNotFound, ErrorType.NotFound);
        }

        // A deleted comment is a tombstone. Voting on one would increment a count attached to text
        // nobody can read, and the thread read only returns it at all so its replies stay reachable.
        if (comment.IsDeleted)
        {
            return Fail<UpvoteResponse>(
                "This comment has been deleted.", ErrorType.Validation);
        }

        var state = await _comments.ToggleUpvoteAsync(commentId, caller.UserId, cancellationToken);

        return Result<UpvoteResponse>.Success(new UpvoteResponse(state.UpvoteCount, state.HasUpvoted));
    }

    // The one write path, shared by top-level comments and replies so the two cannot drift apart on
    // which checks they run.
    private async Task<Result<CommentResponse>> AddInternalAsync(
        Guid assignmentId,
        Guid? targetCommentId,
        CreateCommentRequest request,
        CancellationToken cancellationToken)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<CommentResponse>("Not authenticated.", ErrorType.Unauthorized);
        }

        var access = await AuthorizeOnAssignmentAsync(assignmentId, caller, cancellationToken);
        if (!access.IsSuccess)
        {
            return Fail<CommentResponse>(access.Error!, access.ErrorType);
        }

        var content = request.Content?.Trim() ?? string.Empty;

        // The validator has already rejected both of these through the filter. Repeated here for the
        // same reason rule 5 is checked twice: the service must not depend on having been reached
        // through the pipeline, and every unit test calls it directly.
        if (content.Length == 0)
        {
            return Fail<CommentResponse>("Content is required.", ErrorType.Validation);
        }

        if (content.Length > CreateCommentValidator.ContentMaxLength)
        {
            return Fail<CommentResponse>(
                $"Content cannot exceed {CreateCommentValidator.ContentMaxLength} characters.",
                ErrorType.Validation);
        }

        // "Reply to this comment" becomes a (parent, addressee) pair here, and this is the only place that
        // knows how — which is what keeps the two-level invariant true by construction rather than by
        // every caller remembering it.
        Guid? parentCommentId = null;
        Guid? replyToCommentId = null;
        CommentEntity? addressee = null;

        if (targetCommentId is { } targetId)
        {
            var target = await _comments.GetByIdAsync(targetId, cancellationToken);

            if (target is null || target.AssignmentId != assignmentId)
            {
                return Fail<CommentResponse>(CommentNotFound, ErrorType.NotFound);
            }

            // Replying to a tombstone would attach words to text nobody can read. Checked on the target,
            // not on the root: answering somebody inside a thread whose opening comment was deleted is
            // perfectly sensible, and the tombstone exists precisely to keep that thread reachable.
            if (target.IsDeleted)
            {
                return Fail<CommentResponse>(
                    "This comment has been deleted.", ErrorType.Validation);
            }

            if (target.ParentCommentId is { } rootId)
            {
                // A reply to a reply. It joins the thread it was written into rather than opening a third
                // level, and records who it answers so the client can render an @mention — the mention is
                // what carries the information the missing indent would have.
                //
                // One hop is enough because the target is itself guaranteed to hang off a top-level
                // comment: every reply gets its parent from this branch or the one below, so there is no
                // chain to walk and no recursion to bound.
                parentCommentId = rootId;
                replyToCommentId = target.Id;
                addressee = target;
            }
            else
            {
                // Replying straight to a top-level comment. No addressee is recorded: the reply already
                // sits directly under the person it answers, so a mention would restate its position.
                parentCommentId = target.Id;
            }
        }

        var comment = CommentEntity.Create(
            assignmentId, caller.UserId, content, parentCommentId, replyToCommentId);

        await _comments.AddAsync(comment, cancellationToken);
        await _comments.SaveChangesAsync(cancellationToken);

        // Author is empty on a freshly constructed entity, so the name is fetched — the same reason
        // SubmissionService.SubmitAsync looks the student up rather than reading submission.Student.
        var author = await _users.GetByIdAsync(caller.UserId, cancellationToken);

        // The addressee's name, on the one path that has an addressee at all. GetByIdAsync deliberately
        // does not Include Author, and the client needs the mention on the row it just posted rather than
        // only after the next thread read — an optimistic UI that appends this response would otherwise
        // show a reply whose mention appears out of nowhere on refresh.
        var addresseeName = addressee is null
            ? null
            : addressee.AuthorId == caller.UserId
                // Replying to yourself: the name is already in hand, so this is not worth a round trip.
                ? author?.FullName
                : (await _users.GetByIdAsync(addressee.AuthorId, cancellationToken))?.FullName;

        return Result<CommentResponse>.Success(new CommentResponse(
            comment.Id,
            comment.Content,
            comment.AuthorId,
            author?.FullName ?? string.Empty,
            comment.CreatedAt,
            // A new comment has no votes and cannot have been voted on by its own author yet.
            UpvoteCount: 0,
            HasUpvoted: false,
            IsDeleted: false,
            ReplyToCommentId: replyToCommentId,
            ReplyToAuthorName: addresseeName,
            Replies: []));
    }

    // "May this caller see this assignment?" — answered by delegating to the queries that already
    // enforce rules 3, 4 and 6, never by re-deciding it here.
    private async Task<Result<AssignmentEntity>> AuthorizeOnAssignmentAsync(
        Guid assignmentId,
        (Guid UserId, Role Role) caller,
        CancellationToken cancellationToken)
    {
        // Rules 3 and 6 in one call. A draft, or a class the student is not enrolled in, comes back null
        // and reads as 404 — never 403, which would confirm the assignment exists (assumption A7).
        if (caller.Role == Role.Student)
        {
            var visible = await _assignments.GetPublishedForStudentAsync(
                assignmentId, caller.UserId, cancellationToken);

            return visible is null
                ? Result<AssignmentEntity>.Failure(AssignmentNotFound, ErrorType.NotFound)
                : Result<AssignmentEntity>.Success(visible);
        }

        var assignment = await _assignments.GetByIdAsync(assignmentId, cancellationToken);

        if (assignment is null)
        {
            return Result<AssignmentEntity>.Failure(AssignmentNotFound, ErrorType.NotFound);
        }

        // Rule 4, against the assignment's class and subject rather than its author — matching
        // SubmissionService, where a teacher newly assigned to a subject can grade work already in it.
        // Applied to drafts too: a teacher who cannot touch the assignment cannot read its thread.
        if (caller.Role == Role.Teacher &&
            !await _classes.TeacherAssignmentExistsAsync(
                caller.UserId, assignment.ClassId, assignment.SubjectId, cancellationToken))
        {
            return Result<AssignmentEntity>.Failure(NotAssigned, ErrorType.Forbidden);
        }

        // Admin falls through unscoped, as everywhere else (A6): full visibility, no teaching scope.
        return Result<AssignmentEntity>.Success(assignment);
    }

    // Flat rows -> two-level tree. One pass to bucket the replies by parent, then one pass over the
    // top-level rows, so this is O(n) rather than a scan of the whole list per parent.
    private static IReadOnlyList<CommentResponse> BuildThread(IReadOnlyList<CommentThreadRow> rows)
    {
        var repliesByParent = rows
            .Where(r => r.ParentCommentId is not null)
            .GroupBy(r => r.ParentCommentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        return rows
            .Where(r => r.ParentCommentId is null)
            .Select(parent => ToResponse(
                parent,
                repliesByParent.TryGetValue(parent.Id, out var replies)
                    // A reply's own Replies list is always empty. Not because replying to a reply is
                    // refused — it is not — but because AddInternalAsync normalises such a reply onto this
                    // same parent, so it arrives as another sibling in this list rather than as a child of
                    // one of them. The ordering by CreatedAt then puts it after the comment it answers.
                    ? replies.Select(reply => ToResponse(reply, [])).ToList()
                    : []))
            .ToList();
    }

    private static CommentResponse ToResponse(
        CommentThreadRow row,
        IReadOnlyList<CommentResponse> replies) =>
        new(
            row.Id,
            // The content of a deleted comment never leaves the server. The row is returned only so its
            // replies stay reachable, and the UI renders its placeholder from IsDeleted — sending the
            // original text along would put it in plain sight in the network tab.
            row.IsDeleted ? string.Empty : row.Content,
            row.AuthorId,
            // The author of a deleted comment is withheld for the same reason: the tombstone is there to
            // hold a position in the thread, not to record who was removed from it.
            row.IsDeleted ? string.Empty : row.AuthorName,
            row.CreatedAt,
            row.UpvoteCount,
            row.HasUpvoted,
            row.IsDeleted,
            // Both dropped when the addressed comment has since been deleted. Withholding the name follows
            // the tombstone rule above; dropping the id with it avoids handing the client a link to a row
            // the read may not even have returned, since a deleted *reply* is omitted from the thread.
            row.ReplyToIsDeleted ? null : row.ReplyToCommentId,
            row.ReplyToIsDeleted ? null : row.ReplyToAuthorName,
            replies);

    private (Guid UserId, Role Role)? ResolveCaller()
    {
        if (_currentUser.UserId is not { } userId)
        {
            return null;
        }

        return Enum.TryParse<Role>(_currentUser.Role, ignoreCase: false, out var role)
            ? (userId, role)
            : null;
    }

    private static Result<T> Fail<T>(string error, ErrorType errorType) =>
        Result<T>.Failure(error, errorType);
}
