using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Auth;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Services;

public sealed class AuthService : IAuthService
{
    // One message for every credential failure. Saying "no such email" versus "wrong password"
    // hands an attacker a free account-enumeration oracle.
    private const string InvalidCredentials = "Invalid email or password.";

    private readonly IUserRepository _users;
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwt;

    public AuthService(
        IUserRepository users,
        IRefreshTokenRepository refreshTokens,
        IPasswordHasher passwordHasher,
        IJwtService jwt)
    {
        _users = users;
        _refreshTokens = refreshTokens;
        _passwordHasher = passwordHasher;
        _jwt = jwt;
    }

    public async Task<Result<AuthResponse>> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Result<AuthResponse>.Failure(InvalidCredentials, ErrorType.Unauthorized);
        }

        var user = await _users.GetByEmailAsync(request.Email.Trim(), cancellationToken);

        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<AuthResponse>.Failure(InvalidCredentials, ErrorType.Unauthorized);
        }

        return Result<AuthResponse>.Success(await IssueTokensAsync(user, cancellationToken));
    }

    public async Task<Result<AuthResponse>> RefreshAsync(
        RefreshRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return Result<AuthResponse>.Failure("Refresh token is required.", ErrorType.Unauthorized);
        }

        var stored = await _refreshTokens.GetByTokenAsync(request.RefreshToken, cancellationToken);

        // IsActive covers both expiry and revocation, so this cannot check one and miss the other.
        if (stored is null || !stored.IsActive(DateTime.UtcNow))
        {
            return Result<AuthResponse>.Failure(
                "Refresh token is invalid, expired, or already used.", ErrorType.Unauthorized);
        }

        // Rotation: the presented token dies here even though the client just used it correctly.
        // A refresh token is single-use, so replaying a stolen one fails on the second attempt.
        stored.Revoke();

        return Result<AuthResponse>.Success(await IssueTokensAsync(stored.User, cancellationToken));
    }

    public async Task<Result> LogoutAsync(
        Guid userId,
        LogoutRequest request,
        CancellationToken cancellationToken = default)
    {
        var stored = await _refreshTokens.GetByTokenAsync(request.RefreshToken, cancellationToken);

        // Unknown or already-dead tokens report success: logout is idempotent, and telling a caller
        // "that token does not exist" would let them probe which tokens are live.
        if (stored is null || stored.IsRevoked)
        {
            return Result.Success();
        }

        // Scope check — a valid access token must not be usable to revoke somebody else's session.
        if (stored.UserId != userId)
        {
            return Result.Failure("Refresh token does not belong to the current user.", ErrorType.Forbidden);
        }

        stored.Revoke();
        await _refreshTokens.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    public async Task<Result<UserProfileResponse>> GetProfileAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _users.GetByIdAsync(userId, cancellationToken);

        // Reachable with a still-valid token for an account deleted mid-session.
        return user is null
            ? Result<UserProfileResponse>.Failure("User not found.", ErrorType.NotFound)
            : Result<UserProfileResponse>.Success(ToProfile(user));
    }

    // Shared by login and refresh so both paths produce identical token pairs and lifetimes.
    private async Task<AuthResponse> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var accessToken = _jwt.GenerateAccessToken(user);
        var refreshToken = _jwt.GenerateRefreshToken(user.Id);

        await _refreshTokens.AddAsync(refreshToken, cancellationToken);

        // One save: on refresh this commits the old token's revocation and the new token together,
        // so a crash cannot leave the client holding a token that was never stored.
        await _refreshTokens.SaveChangesAsync(cancellationToken);

        return new AuthResponse(accessToken, refreshToken.Token, ToProfile(user));
    }

    private static UserProfileResponse ToProfile(User user) =>
        new(user.Id, user.FullName, user.Email, user.Role.ToString(), user.CreatedAt);
}
