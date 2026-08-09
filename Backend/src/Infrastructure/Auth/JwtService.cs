using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AssignmentSystem.Infrastructure.Auth;

public sealed class JwtService : IJwtService
{
    private readonly JwtSettings _settings;
    private readonly SymmetricSecurityKey _signingKey;

    public JwtService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
        _signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));
    }

    public string GenerateAccessToken(User user)
    {
        var now = DateTime.UtcNow;

        // Short claim names, not the WS-* URIs the handler maps to by default. The token stays
        // compact and matches docs/03's documented shape; MapInboundClaims = false on the
        // validating side keeps them intact. "jti" exists so an individual token could be
        // denylisted later without invalidating every token for that user.
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("role", user.Role.ToString()),

            // Added explicitly: the JwtSecurityToken constructor emits "nbf" and "exp" but not
            // "iat", and docs/03 documents "iat" as part of the token shape.
            new(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now).ToString(),
                ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_settings.AccessTokenExpiryMinutes),
            signingCredentials: new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public RefreshToken GenerateRefreshToken(Guid userId)
    {
        // 256 bits from a CSPRNG — a refresh token is a bearer credential, so it must not be
        // guessable and must not encode anything. Base64url so it survives JSON and headers
        // without escaping.
        var bytes = RandomNumberGenerator.GetBytes(32);
        var token = Base64UrlEncoder.Encode(bytes);

        return RefreshToken.Create(token, userId, DateTime.UtcNow.AddDays(_settings.RefreshTokenExpiryDays));
    }

    public ClaimsPrincipal? ValidateExpiredToken(string token)
    {
        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = _signingKey,
            ValidateIssuer = true,
            ValidIssuer = _settings.Issuer,
            ValidateAudience = true,
            ValidAudience = _settings.Audience,
            ValidateLifetime = false, // the point of this method — the token has already expired
            ClockSkew = TimeSpan.Zero,
            NameClaimType = JwtRegisteredClaimNames.Sub,
            RoleClaimType = "role"
        };

        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = handler.ValidateToken(token, parameters, out var validated);

            // Pin the algorithm. Without this a token whose header claims a different (or absent)
            // algorithm could satisfy validation — the classic JWT downgrade.
            if (validated is not JwtSecurityToken jwt ||
                !jwt.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.Ordinal))
            {
                return null;
            }

            return principal;
        }
        catch (Exception ex) when (ex is SecurityTokenException or ArgumentException)
        {
            // Malformed, wrong signature, wrong issuer/audience — all expected inputs on a
            // public endpoint, so they map to "no principal" rather than a 500.
            return null;
        }
    }
}
