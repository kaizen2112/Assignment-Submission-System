using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Repositories;

public sealed class CommentRepository : ICommentRepository
{
    private readonly AppDbContext _context;

    public CommentRepository(AppDbContext context) => _context = context;

    // One query for the whole thread, not one per level.
    //
    // The upvote count and HasUpvoted are computed in SQL as correlated sub-selects rather than by
    // Include-ing the Upvotes collection: loading every upvote row to count it in memory is the
    // textbook version of this being slow on the one screen it appears on, and HasUpvoted only ever
    // needs an EXISTS.
    //
    // AsNoTracking because this is a pure read — the tree the service builds from these rows is
    // discarded after mapping, and tracking would have EF diffing rows nobody intends to change.
    public async Task<IReadOnlyList<CommentThreadRow>> GetForAssignmentAsync(
        Guid assignmentId,
        Guid readerId,
        CancellationToken cancellationToken = default)
    {
        var rows = await _context.Comments
            .AsNoTracking()
            .Where(c => c.AssignmentId == assignmentId)
            // The visibility rule from ICommentRepository: keep a live comment, or a deleted one that is
            // top-level and still has at least one live reply hanging off it. That second clause is what
            // stops a deleted parent taking other people's replies out of the thread with it.
            .Where(c =>
                !c.IsDeleted ||
                (c.ParentCommentId == null &&
                 _context.Comments.Any(r => r.ParentCommentId == c.Id && !r.IsDeleted)))
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentThreadRow(
                c.Id,
                c.Content,
                c.AuthorId,
                c.Author.FullName,
                c.ParentCommentId,
                c.IsDeleted,
                c.CreatedAt,
                _context.CommentUpvotes.Count(u => u.CommentId == c.Id),
                _context.CommentUpvotes.Any(u => u.CommentId == c.Id && u.UserId == readerId),
                // The addressed comment, for the @mention. A LEFT JOIN through the ReplyTo navigation
                // rather than a second query per reply: the column is null on almost every row, and null
                // propagation through the projection gives back null without EF needing a case guard.
                c.ReplyToCommentId,
                c.ReplyTo!.Author.FullName,
                // Written as a comparison rather than `c.ReplyTo!.IsDeleted` because the target field is
                // non-nullable bool: on the overwhelming majority of rows the join finds nothing, and SQL
                // NULL has nowhere to land. This form makes "no addressee" read as false.
                c.ReplyTo != null && c.ReplyTo.IsDeleted))
            .ToListAsync(cancellationToken);

        return rows;
    }

    // Tracked, because the delete path mutates what this returns.
    //
    // No Include of the assignment: callers compare comment.AssignmentId against the id in the route and
    // load the assignment itself through IAssignmentRepository, whose queries carry the scoping rules.
    // Pulling the parent in here would be an unscoped second way to reach it.
    public Task<Comment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Comments.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task AddAsync(Comment comment, CancellationToken cancellationToken = default) =>
        await _context.Comments.AddAsync(comment, cancellationToken);

    // The row's existence is the vote, so the toggle is a delete or an insert — never an UPDATE of a
    // flag. The count is read after the change so the caller gets the post-toggle number without a
    // second call that could observe a different state.
    public async Task<UpvoteState> ToggleUpvoteAsync(
        Guid commentId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var existing = await _context.CommentUpvotes
            .FirstOrDefaultAsync(u => u.CommentId == commentId && u.UserId == userId, cancellationToken);

        if (existing is null)
        {
            await _context.CommentUpvotes.AddAsync(
                CommentUpvote.Create(commentId, userId), cancellationToken);
        }
        else
        {
            _context.CommentUpvotes.Remove(existing);
        }

        await _context.SaveChangesAsync(cancellationToken);

        var count = await _context.CommentUpvotes
            .CountAsync(u => u.CommentId == commentId, cancellationToken);

        // hasUpvoted is derived from which branch ran, not re-queried: the insert or delete has already
        // been committed, so the answer is known and a second read would only add latency.
        return new UpvoteState(count, existing is null);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);
}
