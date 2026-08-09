using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class TeacherAssignmentConfiguration : IEntityTypeConfiguration<TeacherAssignment>
{
    public void Configure(EntityTypeBuilder<TeacherAssignment> builder)
    {
        builder.ToTable("teacher_assignments");
        builder.HasKey(ta => ta.Id);

        builder.Property(ta => ta.AssignedAt).IsRequired();

        builder.HasOne(ta => ta.Teacher)
            .WithMany(u => u.TeacherAssignments)
            .HasForeignKey(ta => ta.TeacherId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ta => ta.Subject)
            .WithMany(s => s.TeacherAssignments)
            .HasForeignKey(ta => ta.SubjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Class has no TeacherAssignments collection, so this side stays unidirectional.
        // Cascade, not Restrict: PostgreSQL evaluates ON DELETE RESTRICT immediately, so a
        // Restrict here would abort a class deletion even though the same rows are already
        // being removed by the cascade through Subject. Multiple cascade paths into one table
        // are legal in PostgreSQL (unlike SQL Server), and this row is meaningless once either
        // its class or its subject is gone.
        builder.HasOne(ta => ta.Class)
            .WithMany()
            .HasForeignKey(ta => ta.ClassId)
            .OnDelete(DeleteBehavior.Cascade);

        // The rule-4 guard queries exactly this triple on every teacher mutation, so the index
        // is both the lookup path and the duplicate-prevention constraint.
        builder.HasIndex(ta => new { ta.TeacherId, ta.SubjectId, ta.ClassId }).IsUnique();
    }
}
