using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Class;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
// Not under /admin, deliberately. Everything in AdminController manages classes; this reads the caller's
// own place in them, which is a different question asked by a different role.
[Route("api/v1/classes")]
[Authorize]
[Produces("application/json")]
public sealed class ClassesController : ControllerBase
{
    private const string Student = "Student";

    private readonly IClassService _classes;

    public ClassesController(IClassService classes) => _classes = classes;

    // "mine" rather than /classes?studentId=… — the id comes from the token, and a route with no id in it
    // cannot be pointed at another student in the first place. Same shape as
    // /assignments/{id}/submissions/mine.
    [HttpGet("mine")]
    [Authorize(Roles = Student)]
    [ProducesResponseType(typeof(PagedResult<EnrolledClassResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMine([FromQuery] PagedQueryParameters query, CancellationToken ct)
    {
        var result = await _classes.GetMyClassesAsync(query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    // The roster of one of the caller's own classes. Nested under the class rather than a flat
    // /classmates?classId=…, because a student may be in several and the class is what is being read.
    //
    // 404 for a class the caller is not enrolled in — never 403, which would confirm it exists (A7).
    [HttpGet("{classId:guid}/classmates")]
    [Authorize(Roles = Student)]
    [ProducesResponseType(typeof(PagedResult<ClassmateResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClassmates(
        Guid classId,
        [FromQuery] PagedQueryParameters query,
        CancellationToken ct)
    {
        var result = await _classes.GetClassmatesAsync(classId, query, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }
}
