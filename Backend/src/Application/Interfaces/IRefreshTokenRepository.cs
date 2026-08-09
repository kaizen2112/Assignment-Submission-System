using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);

    Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);

    // Explicit save so rotation can revoke the old token and insert the new one in a single
    // transaction — never one without the other.
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
