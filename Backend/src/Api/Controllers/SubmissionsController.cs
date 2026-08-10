using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.DTOs.Submission;
using AssignmentSystem.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
// Nested under the assignment, as docs/04 specifies. A submission has no meaning without one, and
// the service checks the child really belongs to the parent in the route.
[Route("api/v1/assignments/{assignmentId:guid}/submissions")]
[Authorize]
[Produces("application/json")]
public sealed class SubmissionsController : ControllerBase
{
    private const string Teacher = "Teacher";
    private const string Student = "Student";

    private readonly ISubmissionService _submissions;

    public SubmissionsController(ISubmissionService submissions) => _submissions = submissions;

    [HttpGet]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(typeof(PagedResult<SubmissionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetForAssignment(
        Guid assignmentId,
        [FromQuery] PagedQueryParameters query,
        CancellationToken ct)
    {
        var result = await _submissions.GetPagedForAssignmentAsync(assignmentId, query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPost]
    [Authorize(Roles = Student)]
    [ProducesResponseType(typeof(SubmissionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit(
        Guid assignmentId,
        [FromBody] SubmitAnswerRequest request,
        CancellationToken ct)
    {
        // 400 past the deadline when late submission is off (rule 1); 409 on a second attempt (A4);
        // 404 for a draft or another class's assignment (rules 3 and 6, assumption A7).
        var result = await _submissions.SubmitAsync(assignmentId, request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetMine), new { assignmentId }, result.Value)
            : result.ToProblemResult();
    }

    // "mine" rather than a studentId in the path: an id would invite one student to try another's,
    // and the answer would have to be a 404 anyway. There is nothing here to tamper with.
    [HttpGet("mine")]
    [Authorize(Roles = Student)]
    [ProducesResponseType(typeof(SubmissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMine(Guid assignmentId, CancellationToken ct)
    {
        var result = await _submissions.GetMineAsync(assignmentId, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPut("mine")]
    [Authorize(Roles = Student)]
    [ProducesResponseType(typeof(SubmissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMine(
        Guid assignmentId,
        [FromBody] SubmitAnswerRequest request,
        CancellationToken ct)
    {
        // 400 after the deadline, or once graded (rule 2).
        var result = await _submissions.UpdateMineAsync(assignmentId, request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPatch("{submissionId:guid}/grade")]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(typeof(SubmissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Grade(
        Guid assignmentId,
        Guid submissionId,
        [FromBody] GradeSubmissionRequest request,
        CancellationToken ct)
    {
        // 400 when marks fall outside 0..MaxMarks (rule 5); 403 when the teacher does not hold this
        // class and subject (rule 4).
        var result = await _submissions.GradeAsync(assignmentId, submissionId, request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPatch("{submissionId:guid}/status")]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(typeof(SubmissionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangeStatus(
        Guid assignmentId,
        Guid submissionId,
        [FromBody] ChangeSubmissionStatusRequest request,
        CancellationToken ct)
    {
        // 400 for any transition rule 8 disallows — notably un-grading.
        var result = await _submissions.ChangeStatusAsync(assignmentId, submissionId, request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }
}
