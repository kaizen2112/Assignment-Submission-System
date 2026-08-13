using AssignmentSystem.Api.Extensions;
using AssignmentSystem.Application.DTOs.Auth;
using AssignmentSystem.Application.DTOs.Profile;
using AssignmentSystem.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
[Produces("application/json")]
public sealed class UsersController : ControllerBase
{
    private readonly IProfileService _profile;

    public UsersController(IProfileService profile) => _profile = profile;

    // No [Authorize(Roles = …)] on either action, and that is correct rather than an omission: every role edits
    // their own account, so there is no role to narrow to. The class-level [Authorize] still requires a token,
    // and `me` in the route means there is no id a caller could swap for somebody else's.
    //
    // Contrast /admin/users/{id}, which is Admin-only and can set an email and a role. These two endpoints look
    // alike and are not: one is administration, this one is self-service.
    [HttpPut("me")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateMe(
        [FromBody] UpdateProfileRequest request,
        CancellationToken ct)
    {
        var result = await _profile.UpdateMineAsync(request, ct);

        return result.IsSuccess ? Ok(result.Value) : result.ToProblemResult();
    }

    // 204, not 200: there is nothing to return, and returning the profile would suggest something about it
    // had changed.
    [HttpPut("me/password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangeMyPassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken ct)
    {
        // A wrong current password comes back 400, not 401. A 401 would tell the client's interceptor that the
        // session had expired, and it would attempt a refresh and then sign the user out over a typo.
        var result = await _profile.ChangeMyPasswordAsync(request, ct);

        return result.IsSuccess ? NoContent() : result.ToProblemResult();
    }
}
