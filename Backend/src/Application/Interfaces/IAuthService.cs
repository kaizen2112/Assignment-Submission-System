using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Auth;

namespace AssignmentSystem.Application.Interfaces;

public interface IAuthService
{
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    Task<Result<AuthResponse>> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default);

    Task<Result> LogoutAsync(Guid userId, LogoutRequest request, CancellationToken cancellationToken = default);

    Task<Result<UserProfileResponse>> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default);
}
