using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class AssignmentConfiguration : IEntityTypeConfiguration<Assignment>
{
    public void Configure(EntityTypeBuilder<Assignment> builder)
    {
        builder.ToTable("assignments");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Title).IsRequired().HasMaxLength(200);
        builder.Property(a => a.Description).IsRequired().HasMaxLength(5000);
        builder.Property(a => a.Deadline).IsRequired();
        builder.Property(a => a.MaxMarks).IsRequired();
        builder.Property(a => a.Status).IsRequired().HasConversion<string>().HasMaxLength(20);

        // Default enforced at the DB level too, so a row inserted outside the application
        // (a manual fix, a future bulk import) still gets the strict behaviour.
        builder.Property(a => a.AllowLateSubmission).IsRequired().HasDefaultValue(false);

        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt).IsRequired();

        builder.HasOne(a => a.Class)
            .WithMany(c => c.Assignments)
            .HasForeignKey(a => a.ClassId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cascade for the same reason as the Class FK: a Restrict here would make deleting a
        // class fail outright, because PostgreSQL checks RESTRICT immediately rather than
        // waiting to see that the cascade through Subject already removed the row.
        builder.HasOne(a => a.Subject)
            .WithMany(s => s.Assignments)
            .HasForeignKey(a => a.SubjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict is deliberate here, and only fires when deleting the *user*: removing a
        // teacher account must not silently destroy their assignments and every student's
        // graded work underneath. Admin has to reassign first. Deleting a class still works,
        // because that cascade never touches the users table.
        builder.HasOne(a => a.CreatedByTeacher)
            .WithMany()
            .HasForeignKey(a => a.CreatedByTeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        // The student-facing list query is "published assignments for my class" (rules 3 and 6).
        builder.HasIndex(a => new { a.ClassId, a.Status });
        builder.HasIndex(a => a.Deadline);
    }
}
