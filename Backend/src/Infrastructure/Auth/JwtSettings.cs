namespace AssignmentSystem.Infrastructure.Auth;

public sealed class JwtSettings
{
    public const string SectionName = "JwtSettings";

    // HS256 requires a key of at least 256 bits. Program.cs fails fast on a shorter one rather
    // than letting the first login throw from inside the token handler.
    public const int MinimumKeyLengthBytes = 32;

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int AccessTokenExpiryMinutes { get; set; } = 15;
    public int RefreshTokenExpiryDays { get; set; } = 7;
}
