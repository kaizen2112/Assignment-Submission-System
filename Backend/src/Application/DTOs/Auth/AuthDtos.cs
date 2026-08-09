namespace AssignmentSystem.Application.DTOs.Auth;

// Records, not classes: these are immutable messages, and value equality makes them trivial to
// assert on in tests.
public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

public sealed record UserProfileResponse(Guid Id, string FullName, string Email, string Role);

// Shape fixed by docs/04. No expiry field: the client can read "exp" from the token itself, and
// returning a second copy of it invites the two disagreeing. If Phase 5 wants it surfaced, add it
// via IJwtService rather than by parsing the token string here.
public sealed record AuthResponse(
    string AccessToken,
    string RefreshToken,
    UserProfileResponse User);
