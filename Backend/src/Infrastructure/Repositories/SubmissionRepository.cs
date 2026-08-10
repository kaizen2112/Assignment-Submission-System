using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Repositories;

public sealed class SubmissionRepository : ISubmissionRepository
{
    private readonly AppDbContext _context;

    public SubmissionRepository(AppDbContext context) => _context = context;

    // Tracked, and the Assignment comes with it: grading checks MaxMarks (rule 5) and the update
    // path checks Deadline (rule 2), so every caller needs the parent anyway.
    public Task<Submission?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Submissions
            .Include(s => s.Assignment)
            .Include(s => s.Student)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    // The StudentId filter is the enforcement of rule 3, and it lives here rather than in the
    // service so no caller can forget it.
    public Task<Submission?> GetByAssignmentAndStudentAsync(
        Guid assignmentId,
        Guid studentId,
        CancellationToken cancellationToken = default) =>
        _context.Submissions
            .Include(s => s.Assignment)
            .FirstOrDefaultAsync(
                s => s.AssignmentId == assignmentId && s.StudentId == studentId,
                cancellationToken);

    public Task<bool> ExistsForAssignmentAndStudentAsync(
        Guid assignmentId,
        Guid studentId,
        CancellationToken cancellationToken = default) =>
        _context.Submissions.AnyAsync(
            s => s.AssignmentId == assignmentId && s.StudentId == studentId,
            cancellationToken);

    public Task<PagedResult<Submission>> GetPagedForAssignmentAsync(
        Guid assignmentId,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default) =>
        ApplySort(
                _context.Submissions
                    .Where(s => s.AssignmentId == assignmentId)
                    .Include(s => s.Student)
                    .AsNoTracking(),
                pagination)
            .ToPagedResultAsync(pagination, cancellationToken);

    public Task<PagedResult<Submission>> GetPagedForAdminAsync(
        PaginationQuery pagination,
        CancellationToken cancellationToken = default) =>
        ApplySort(
                _context.Submissions
                    .Include(s => s.Student)
                    .Include(s => s.Assignment)
                    .AsNoTracking(),
                pagination)
            .ToPagedResultAsync(pagination, cancellationToken);

    public async Task AddAsync(Submission submission, CancellationToken cancellationToken = default) =>
        await _context.Submissions.AddAsync(submission, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    // Allow-listed columns only, and every branch ends on Id so paging is stable across requests —
    // see the note in AssignmentRepository.ApplySort.
    private static IQueryable<Submission> ApplySort(IQueryable<Submission> query, PaginationQuery pagination)
    {
        var descending = pagination.SortDescending;

        return pagination.SortBy?.ToLowerInvariant() switch
        {
            // Nulls sort together at one end, which is what a grader wants: ungraded work in a block
            // rather than scattered through the list.
            "marks" => descending
                ? query.OrderByDescending(s => s.Marks).ThenBy(s => s.Id)
                : query.OrderBy(s => s.Marks).ThenBy(s => s.Id),
            "status" => descending
                ? query.OrderByDescending(s => s.Status).ThenBy(s => s.Id)
                : query.OrderBy(s => s.Status).ThenBy(s => s.Id),
            _ => descending
                ? query.OrderByDescending(s => s.SubmittedAt).ThenBy(s => s.Id)
                : query.OrderBy(s => s.SubmittedAt).ThenBy(s => s.Id)
        };
    }
}
