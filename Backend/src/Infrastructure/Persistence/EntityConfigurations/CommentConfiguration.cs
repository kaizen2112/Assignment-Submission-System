using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.EntityConfigurations;

public sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Content).IsRequired().HasMaxLength(1000);
        builder.Property(c => c.IsDeleted).IsRequired().HasDefaultValue(false);
        builder.Property(c => c.CreatedAt).IsRequired();

        // WithMany() with no argument on all three relationships below, deliberately. The inverse
        // navigations would have to be added to Assignment and User, and this feature is additive —
        // nothing already in the model changes shape because comments were bolted on. EF does not need
        // the inverse side to build the foreign key or the cascade.
        //
        // HasOne<Assignment>() with no navigation on *this* side either: Comment holds AssignmentId and
        // nothing more. Every path that needs the assignment loads it through IAssignmentRepository, so
        // that its scoped queries — rules 3, 4 and 6 — are the only way in. A navigation here would offer
        // a second, unscoped route to the same object.
        builder.HasOne<Assignment>()
            .WithMany()
            .HasForeignKey(c => c.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cascade, unlike Submission.Student which is Restrict. A submission is the record of graded
        // academic work and deleting the account must fail loudly; a comment is conversation, and
        // blocking an account deletion because someone once posted "thanks" would be absurd.
        //
        // The admin delete path already 409s when a user holds academic records, so this cascade can
        // only ever fire for a user who has nothing but comments.
        builder.HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Cascade);

        // The self-reference. Cascade so that if a parent row is ever hard-deleted its replies go with
        // it rather than becoming orphans pointing at nothing — the application only ever soft-deletes,
        // so in practice this fires only as part of the assignment cascade above.
        builder.HasOne(c => c.ParentComment)
            .WithMany(c => c.Replies)
            .HasForeignKey(c => c.ParentCommentId)
            .OnDelete(DeleteBehavior.Cascade);

        // The second self-reference: who a reply was addressed to. SetNull, not Cascade — the opposite of
        // ParentCommentId above, and the difference is the whole point of having two columns.
        //
        // ParentCommentId is structural: a reply with no parent is not a reply, so it goes when the parent
        // goes. ReplyToCommentId is only annotation — losing it costs the @mention and nothing else, so a
        // hard-deleted target must not take somebody's answer down with it. Under the assignment cascade
        // both rows are going anyway; this matters for the one case where they are not.
        builder.HasOne(c => c.ReplyTo)
            .WithMany()
            .HasForeignKey(c => c.ReplyToCommentId)
            .OnDelete(DeleteBehavior.SetNull);

        // The thread read is always "every comment for this assignment, oldest first", so the index
        // covers the filter and the sort together.
        builder.HasIndex(c => new { c.AssignmentId, c.CreatedAt });

        // Replies are fetched by parent. Without this, expanding a thread scans the whole table.
        builder.HasIndex(c => c.ParentCommentId);
    }
}
