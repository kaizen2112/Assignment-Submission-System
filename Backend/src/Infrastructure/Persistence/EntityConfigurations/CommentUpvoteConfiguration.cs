using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class CommentUpvoteConfiguration : IEntityTypeConfiguration<CommentUpvote>
{
    public void Configure(EntityTypeBuilder<CommentUpvote> builder)
    {
        builder.ToTable("comment_upvotes");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.CreatedAt).IsRequired();

        builder.HasOne(u => u.Comment)
            .WithMany(c => c.Upvotes)
            .HasForeignKey(u => u.CommentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cascade for the same reason as Comment.Author: a vote is not a record worth blocking an
        // account deletion over.
        builder.HasOne(u => u.User)
            .WithMany()
            .HasForeignKey(u => u.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // One vote per person per comment. The service checks first so a normal toggle is a clean
        // insert or delete, but this is the constraint that survives two concurrent requests — without
        // it a double-clicked button can insert twice and the count is permanently wrong.
        builder.HasIndex(u => new { u.CommentId, u.UserId }).IsUnique();
    }
}
