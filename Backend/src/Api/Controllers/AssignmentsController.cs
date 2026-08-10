using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/v1/assignments")]
// Secure by default, same as AuthController. Each action then narrows to the roles docs/04 lists.
[Authorize]
[Produces("application/json")]
public sealed class AssignmentsController : ControllerBase
{
    private const string Teacher = "Teacher";
    private const string Student = "Student";

    private readonly IAssignmentService _assignments;

    public AssignmentsController(IAssignmentService assignments) => _assignments = assignments;

    // Deliberately one endpoint for both roles rather than /my-assignments and /class-assignments.
    // The service scopes on the token's role, so the caller cannot choose whose data to read.
    [HttpGet]
    [Authorize(Roles = $"{Teacher},{Student}")]
    [ProducesResponseType(typeof(PagedResult<AssignmentListItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] AssignmentQueryParameters query,
        CancellationToken ct)
    {
        var result = await _assignments.GetPagedAsync(query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{Teacher},{Student}")]
    [ProducesResponseType(typeof(AssignmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        // A student requesting a draft, or an assignment outside their class, gets 404 here — not
        // 403, which would confirm it exists (assumption A7).
        var result = await _assignments.GetByIdAsync(id, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpPost]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(typeof(AssignmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateAssignmentRequest request, CancellationToken ct)
    {
        // ValidationFilter has already run CreateAssignmentValidator; reaching this line means the
        // shape is valid, and only the business rules are left for the service to check.
        var result = await _assignments.CreateAsync(request, ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value)
            : result.ToProblemResult();
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(typeof(AssignmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateAssignmentRequest request,
        CancellationToken ct)
    {
        var result = await _assignments.UpdateAsync(id, request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    // PATCH, not PUT: this changes one piece of state, and there is no body to send.
    [HttpPatch("{id:guid}/publish")]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(typeof(AssignmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Publish(Guid id, CancellationToken ct)
    {
        var result = await _assignments.PublishAsync(id, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Teacher)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        // 409 when submissions exist (assumption A5) — deleting would destroy graded student work,
        // since submissions cascade from the assignment.
        var result = await _assignments.DeleteAsync(id, ct);

        return result.IsSuccess ? NoContent() : result.ToProblemResult();
    }
}
