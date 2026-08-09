using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.FullName).IsRequired().HasMaxLength(200);
        builder.Property(u => u.Email).IsRequired().HasMaxLength(256);
        builder.Property(u => u.PasswordHash).IsRequired().HasMaxLength(512);

        // Stored as text rather than an int so psql output is readable and reordering the enum
        // cannot silently reinterpret existing rows. Length-capped so the column is varchar,
        // not unbounded text.
        builder.Property(u => u.Role).IsRequired().HasConversion<string>().HasMaxLength(20);

        builder.Property(u => u.CreatedAt).IsRequired();

        // Login looks users up by email, and two accounts sharing one is a correctness bug,
        // not just a slow query.
        builder.HasIndex(u => u.Email).IsUnique();
    }
}
