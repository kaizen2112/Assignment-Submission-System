using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> builder)
    {
        builder.ToTable("subjects");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name).IsRequired().HasMaxLength(100);

        // Cascade: a subject has no meaning once its class is gone, and this is the only
        // owning path to it.
        builder.HasOne(s => s.Class)
            .WithMany(c => c.Subjects)
            .HasForeignKey(s => s.ClassId)
            .OnDelete(DeleteBehavior.Cascade);

        // Two subjects called "Mathematics" in the same class would make TeacherAssignment
        // ambiguous — a teacher could be granted one of them and denied the other.
        builder.HasIndex(s => new { s.ClassId, s.Name }).IsUnique();
    }
}
