using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class StudentEnrollmentConfiguration : IEntityTypeConfiguration<StudentEnrollment>
{
    public void Configure(EntityTypeBuilder<StudentEnrollment> builder)
    {
        builder.ToTable("student_enrollments");
        builder.HasKey(se => se.Id);

        builder.Property(se => se.EnrolledAt).IsRequired();

        builder.HasOne(se => se.Student)
            .WithMany(u => u.Enrollments)
            .HasForeignKey(se => se.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(se => se.Class)
            .WithMany(c => c.Enrollments)
            .HasForeignKey(se => se.ClassId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(se => new { se.StudentId, se.ClassId }).IsUnique();
    }
}
