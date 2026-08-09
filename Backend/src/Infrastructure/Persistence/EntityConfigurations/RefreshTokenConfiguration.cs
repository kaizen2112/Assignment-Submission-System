using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens");
        builder.HasKey(rt => rt.Id);

        // Base64url of 32 bytes is 43 characters; 200 leaves room without being unbounded.
        builder.Property(rt => rt.Token).IsRequired().HasMaxLength(200);
        builder.Property(rt => rt.ExpiresAt).IsRequired();
        builder.Property(rt => rt.IsRevoked).IsRequired().HasDefaultValue(false);
        builder.Property(rt => rt.CreatedAt).IsRequired();

        // The refresh endpoint looks rows up by token value, so this index is the lookup path.
        // Unique because a collision would let one user's token resolve to another's row.
        builder.HasIndex(rt => rt.Token).IsUnique();

        // "Revoke everything for this user" (password change, forced logout) scans by UserId.
        builder.HasIndex(rt => rt.UserId);

        // Cascade, unlike submissions: a token is worthless once the account is gone and is not
        // a record worth preserving. User has no RefreshTokens collection — nothing in the domain
        // needs to walk from a user to their tokens, so the navigation stays one-directional.
        builder.HasOne(rt => rt.User)
            .WithMany()
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
