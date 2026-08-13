using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Auth;
using AssignmentSystem.Application.DTOs.Profile;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Services;

// Self-service account edits. No role checks anywhere in here, deliberately: every role may edit their own
// name and change their own password, and the only question that matters — *whose* account — is answered by
// the token rather than by a parameter.
public sealed class ProfileService : IProfileService
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ICurrentUserService _currentUser;

    public ProfileService(
        IUserRepository users,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUser)
    {
        _users = users;
        _passwordHasher = passwordHasher;
        _currentUser = currentUser;
    }

    public async Task<Result<UserProfileResponse>> UpdateMineAsync(
        UpdateProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var loaded = await LoadCallerAsync(cancellationToken);
        if (!loaded.IsSuccess)
        {
            return Result<UserProfileResponse>.Failure(loaded.Error!, loaded.ErrorType);
        }

        var user = loaded.Value;

        // UpdateProfile, not Update: the entity offers no way to reach Email or Role from here, so the
        // restriction is in the domain rather than in this method remembering to pass the old values back.
        user.UpdateProfile(request.FullName.Trim());
        await _users.SaveChangesAsync(cancellationToken);

        return Result<UserProfileResponse>.Success(
            new UserProfileResponse(
                user.Id, user.FullName, user.Email, user.Role.ToString(), user.CreatedAt));
    }

    public async Task<Result> ChangeMyPasswordAsync(
        ChangePasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var loaded = await LoadCallerAsync(cancellationToken);
        if (!loaded.IsSuccess)
        {
            return Result.Failure(loaded.Error!, loaded.ErrorType);
        }

        var user = loaded.Value;

        // The current password is checked even though the token already authenticated this request. A token
        // proves the session was opened by this user; it does not prove who is at the keyboard now.
        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            // Deliberately not "wrong password" as a 401: a 401 tells api.ts's interceptor that the *session*
            // expired, and it would try to refresh and then sign the user out over a typo. This is a bad field
            // value in an otherwise valid request.
            return Result.Failure("Your current password is incorrect.", ErrorType.Validation);
        }

        // Refusing a no-op change. Not a security rule — it is a usability one: somebody who submits the same
        // password twice has almost certainly misunderstood the form, and silently "succeeding" teaches them
        // that it worked.
        if (_passwordHasher.Verify(request.NewPassword, user.PasswordHash))
        {
            return Result.Failure(
                "Your new password must be different from your current one.", ErrorType.Validation);
        }

        user.SetPasswordHash(_passwordHasher.Hash(request.NewPassword));
        await _users.SaveChangesAsync(cancellationToken);

        // NOTE: existing refresh tokens are deliberately left alone, and this is a known limitation rather
        // than an oversight — see the README. Changing a password ideally revokes every other session, but
        // there is no "revoke all for user" on the repository and adding one touches the auth flow, which is
        // not something to do untested. The user stays signed in everywhere they already were.
        return Result.Success();
    }

    // Both operations start the same way: resolve the caller from the token and load their row. A null user id
    // means the token carried no usable sub — [Authorize] should have caught that, so this is the second lock.
    // A missing row means a token for a since-deleted account, which is a dead session rather than a 404.
    private async Task<Result<User>> LoadCallerAsync(CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not { } userId)
        {
            return Result<User>.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        var user = await _users.GetByIdAsync(userId, cancellationToken);

        return user is null
            ? Result<User>.Failure("Not authenticated.", ErrorType.Unauthorized)
            : Result<User>.Success(user);
    }
}
