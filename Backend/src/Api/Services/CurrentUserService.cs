using System.Security.Claims;
using AssignmentSystem.Application.Interfaces;

namespace AssignmentSystem.Api.Services;

// Lives in Api because IHttpContextAccessor is an ASP.NET type. Application depends only on the
// interface, so services stay testable with a plain stub.
public sealed class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUserService(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    // Reads the raw "sub" claim rather than ClaimTypes.NameIdentifier, because MapInboundClaims
    // is disabled in Program.cs — claims arrive exactly as they were issued.
    public Guid? UserId =>
        Guid.TryParse(Principal?.FindFirst("sub")?.Value, out var id) ? id : null;

    public string? Role => Principal?.FindFirst("role")?.Value;
}
