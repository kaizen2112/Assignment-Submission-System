using System.Security.Claims;
using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Interfaces;

// Lives in Application so services can issue tokens without depending on JWT internals.
// ClaimsPrincipal is BCL, not ASP.NET, so this does not breach the layering rule.
public interface IJwtService
{
    string GenerateAccessToken(User user);

    RefreshToken GenerateRefreshToken(Guid userId);

    // Validates signature, issuer and audience but deliberately ignores expiry, so the refresh
    // endpoint can read the identity out of an access token that has just expired.
    // Returns null instead of throwing — an invalid token is an expected outcome, not a fault.
    ClaimsPrincipal? ValidateExpiredToken(string token);
}
