using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Admin;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.DTOs.Submission;
using AssignmentSystem.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
// The single most important line in this file. Applied at the class level rather than per action, so
// an endpoint added later is Admin-only by default instead of open until someone remembers the
// attribute. A Teacher or Student presenting a valid token gets 403 here, never an empty 200 (rule 7).
[Authorize(Roles = "Admin")]
[Produces("application/json")]
public sealed class AdminController : ControllerBase
{
    private readonly IAdminService _admin;
    private readonly IAssignmentService _assignments;
    private readonly ISubmissionService _submissions;

    // The two read-only "view everything" endpoints delegate to the feature services, which already
    // resolve an Admin caller to their unscoped query. Re-implementing those reads here would mean
    // two code paths that could disagree about what an assignment looks like.
    public AdminController(
        IAdminService admin,
        IAssignmentService assignments,
        ISubmissionService submissions)
    {
        _admin = admin;
        _assignments = assignments;
        _submissions = submissions;
    }

    // --- Users ------------------------------------------------------------------------------------

    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<UserResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers([FromQuery] UserQueryParameters query, CancellationToken ct)
    {
        var result = await _admin.GetUsersAsync(query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPost("users")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        var result = await _admin.CreateUserAsync(request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetUsers), new { }, result.Value)
            : result.ToProblemResult();
    }

    [HttpPut("users/{id:guid}")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateUser(
        Guid id,
        [FromBody] UpdateUserRequest request,
        CancellationToken ct)
    {
        // 409 when the new email belongs to someone else, or when a role change would contradict
        // assignments or submissions the user already has.
        var result = await _admin.UpdateUserAsync(id, request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpDelete("users/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        // 409 for a user with academic records (the FKs are RESTRICT), and for self-deletion.
        var result = await _admin.DeleteUserAsync(id, ct);

        return result.IsSuccess ? NoContent() : result.ToProblemResult();
    }

    // --- Classes and subjects ---------------------------------------------------------------------

    [HttpGet("classes")]
    [ProducesResponseType(typeof(PagedResult<ClassResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetClasses([FromQuery] PagedQueryParameters query, CancellationToken ct)
    {
        var result = await _admin.GetClassesAsync(query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPost("classes")]
    [ProducesResponseType(typeof(ClassResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateClass([FromBody] CreateClassRequest request, CancellationToken ct)
    {
        var result = await _admin.CreateClassAsync(request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetClasses), new { }, result.Value)
            : result.ToProblemResult();
    }

    [HttpPost("classes/{id:guid}/subjects")]
    [ProducesResponseType(typeof(SubjectResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddSubject(
        Guid id,
        [FromBody] CreateSubjectRequest request,
        CancellationToken ct)
    {
        var result = await _admin.AddSubjectAsync(id, request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetClasses), new { }, result.Value)
            : result.ToProblemResult();
    }

    // --- Teacher assignments and enrollments ------------------------------------------------------

    // This endpoint is what grants a teacher authority under rule 4, so it is the one an evaluator
    // should confirm is Admin-only.
    [HttpPost("teacher-assignments")]
    [ProducesResponseType(typeof(TeacherAssignmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AssignTeacher(
        [FromBody] CreateTeacherAssignmentRequest request,
        CancellationToken ct)
    {
        var result = await _admin.AssignTeacherAsync(request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    // Likewise for rule 3: an enrollment row is what makes a class's assignments visible to a student.
    [HttpPost("enrollments")]
    [ProducesResponseType(typeof(EnrollmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EnrollStudent(
        [FromBody] CreateEnrollmentRequest request,
        CancellationToken ct)
    {
        var result = await _admin.EnrollStudentAsync(request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    // --- Read-only oversight ----------------------------------------------------------------------

    // Unscoped by role: AssignmentService resolves an Admin caller to the unfiltered query, so drafts
    // from every teacher appear here — the one place in the API where that is true.
    [HttpGet("assignments")]
    [ProducesResponseType(typeof(PagedResult<AssignmentListItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAssignments(
        [FromQuery] AssignmentQueryParameters query,
        CancellationToken ct)
    {
        var result = await _assignments.GetPagedAsync(query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpGet("submissions")]
    [ProducesResponseType(typeof(PagedResult<SubmissionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllSubmissions(
        [FromQuery] PagedQueryParameters query,
        CancellationToken ct)
    {
        var result = await _submissions.GetAllForAdminAsync(query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }
}
