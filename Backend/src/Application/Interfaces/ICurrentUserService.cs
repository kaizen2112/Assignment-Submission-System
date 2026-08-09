namespace AssignmentSystem.Application.Interfaces;

// Lets services scope queries to the caller without ever touching HttpContext.
//
// All three members are nullable by design. Anonymous endpoints exist (login, refresh), so a
// non-nullable UserId would have to throw when unauthenticated — turning a normal request into
// an exception. Callers that require an identity check IsAuthenticated, or pattern-match UserId.
public interface ICurrentUserService
{
    Guid? UserId { get; }

    string? Role { get; }

    bool IsAuthenticated { get; }
}
