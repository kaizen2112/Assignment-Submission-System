namespace AssignmentSystem.Domain.Entities;

// Stored server-side because a pure-JWT refresh scheme has no way to invalidate a stolen token
// before it expires. A row here can be revoked; a signed string cannot.
public sealed class RefreshToken
{
    private RefreshToken() { }

    public Guid Id { get; private set; }
    public string Token { get; private set; } = null!;

    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;

    public DateTime ExpiresAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // The random value is supplied by the caller: cryptographic randomness is an Infrastructure
    // concern, and Domain has no framework or crypto dependencies.
    public static RefreshToken Create(string token, Guid userId, DateTime expiresAt)
    {
        return new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = token,
            UserId = userId,
            ExpiresAt = expiresAt,
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    // Rotation and logout both revoke rather than delete, so the token history stays auditable.
    public void Revoke() => IsRevoked = true;

    // One place for "may this be exchanged", so a caller cannot check expiry and forget
    // revocation. Time is a parameter to keep the boundary testable.
    public bool IsActive(DateTime utcNow) => !IsRevoked && ExpiresAt > utcNow;
}
