using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Application.DTOs.Comment;
using AssignmentSystem.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
// Nested under the assignment, like submissions: a comment thread has no meaning without one, and the
// service checks the comment in the path really belongs to the assignment in the path.
[Route("api/v1/assignments/{assignmentId:guid}/comments")]
[Authorize]
[Produces("application/json")]
public sealed class CommentsController : ControllerBase
{
    private const string Teacher = "Teacher";
    private const string Student = "Student";
    private const string Admin = "Admin";

    private readonly ICommentService _comments;

    public CommentsController(ICommentService comments) => _comments = comments;

    // Admin reads but does not post (A6). The service still scopes the read: a student only sees threads
    // on published assignments in their own classes, a teacher only on their granted class+subject.
    [HttpGet]
    [Authorize(Roles = $"{Teacher},{Student},{Admin}")]
    [ProducesResponseType(typeof(IReadOnlyList<CommentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetForAssignment(Guid assignmentId, CancellationToken ct)
    {
        var result = await _comments.GetForAssignmentAsync(assignmentId, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPost]
    [Authorize(Roles = $"{Teacher},{Student}")]
    [ProducesResponseType(typeof(CommentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid assignmentId,
        [FromBody] CreateCommentRequest request,
        CancellationToken ct)
    {
        var result = await _comments.AddAsync(assignmentId, request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetForAssignment), new { assignmentId }, result.Value)
            : result.ToProblemResult();
    }

    // A separate route rather than a parentCommentId in the body: the target is part of *where* the
    // comment goes, and a path segment cannot be omitted by accident the way an optional field can.
    //
    // {commentId} is whoever is being answered, which may itself be a reply. That is allowed and does not
    // deepen the thread: the service attaches it to the same top-level comment and records the addressee,
    // and the response comes back with replyToAuthorName set for the client to render as an @mention.
    [HttpPost("{commentId:guid}/replies")]
    [Authorize(Roles = $"{Teacher},{Student}")]
    [ProducesResponseType(typeof(CommentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reply(
        Guid assignmentId,
        Guid commentId,
        [FromBody] CreateCommentRequest request,
        CancellationToken ct)
    {
        // 400 for a reply to a deleted comment; 404 when the target belongs to a different assignment.
        var result = await _comments.AddReplyAsync(assignmentId, commentId, request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetForAssignment), new { assignmentId }, result.Value)
            : result.ToProblemResult();
    }

    // No Roles here on purpose, and it is the one endpoint in the system like that. "The author, or the
    // teacher who holds this class+subject" is not a role — a student may delete their own comment but
    // not a peer's, which no [Authorize(Roles)] can express. The class-level [Authorize] still requires
    // a token, and CommentService.DeleteAsync makes the decision.
    [HttpDelete("{commentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid assignmentId, Guid commentId, CancellationToken ct)
    {
        var result = await _comments.DeleteAsync(assignmentId, commentId, ct);

        return result.IsSuccess ? NoContent() : result.ToProblemResult();
    }

    // POST rather than PUT: the caller is not stating a desired end state, it is asking to flip whichever
    // one it is in. Two rapid clicks therefore net out instead of racing to the same value.
    [HttpPost("{commentId:guid}/upvote")]
    [Authorize(Roles = $"{Teacher},{Student}")]
    [ProducesResponseType(typeof(UpvoteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleUpvote(Guid assignmentId, Guid commentId, CancellationToken ct)
    {
        var result = await _comments.ToggleUpvoteAsync(assignmentId, commentId, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }
}
