using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Auth;
using AssignmentSystem.Application.DTOs.Profile;

namespace AssignmentSystem.Application.Interfaces;

// What a signed-in user may change about their own account, whatever their role.
//
// Separate from IAdminService, which edits *other people's* accounts and can set an email and a role. The two
// look similar and are not: one is administration, the other is self-service, and the difference is exactly
// which fields exist. Merging them would have meant one method whose permitted fields depended on who called
// it — the kind of branch that is one refactor away from letting a student promote themselves.
public interface IProfileService
{
    // Returns the updated profile in the same shape as GET /auth/me, so a client can drop it straight into
    // whatever it already holds rather than mapping a second shape.
    Task<Result<UserProfileResponse>> UpdateMineAsync(
        UpdateProfileRequest request,
        CancellationToken cancellationToken = default);

    // No payload on success: the new password is not something to echo back, and there is nothing else to say.
    Task<Result> ChangeMyPasswordAsync(
        ChangePasswordRequest request,
        CancellationToken cancellationToken = default);
}
