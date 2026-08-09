using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class SubmissionConfiguration : IEntityTypeConfiguration<Submission>
{
    public void Configure(EntityTypeBuilder<Submission> builder)
    {
        builder.ToTable("submissions");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.AnswerText).IsRequired().HasMaxLength(5000);
        builder.Property(s => s.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Feedback).HasMaxLength(2000);
        builder.Property(s => s.IsLate).IsRequired().HasDefaultValue(false);
        builder.Property(s => s.SubmittedAt).IsRequired();

        // Marks, Feedback, UpdatedAt and GradedAt stay nullable — null is the meaningful
        // "not graded / never edited" state, so no IsRequired here.

        builder.HasOne(s => s.Assignment)
            .WithMany(a => a.Submissions)
            .HasForeignKey(s => s.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict: a student's submissions are the record of their graded work. Deleting the
        // account must fail loudly rather than erase marks.
        builder.HasOne(s => s.Student)
            .WithMany(u => u.Submissions)
            .HasForeignKey(s => s.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Rule: one submission per student per assignment. Enforced in the service too, but
        // this is the constraint that survives a race between two concurrent requests.
        builder.HasIndex(s => new { s.AssignmentId, s.StudentId }).IsUnique();
    }
}
