using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Repositories;

public sealed class AssignmentRepository : IAssignmentRepository
{
    private readonly AppDbContext _context;

    public AssignmentRepository(AppDbContext context) => _context = context;

    // Tracked, because callers mutate the result (Publish, update, delete). Class and Subject come
    // along because the detail response shows their names.
    public Task<Assignment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public Task<Assignment?> GetPublishedForStudentAsync(
        Guid id,
        Guid studentId,
        CancellationToken cancellationToken = default) =>
        StudentScope(studentId)
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public Task<PagedResult<Assignment>> GetPagedForTeacherAsync(
        Guid teacherId,
        AssignmentFilter filter,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default) =>
        // Any status: a teacher must be able to see their own drafts (rule 6).
        BuildQuery(_context.Assignments.Where(a => a.CreatedByTeacherId == teacherId), filter, pagination)
            .ToPagedResultAsync(pagination, cancellationToken);

    public Task<PagedResult<Assignment>> GetPagedForStudentAsync(
        Guid studentId,
        AssignmentFilter filter,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default) =>
        BuildQuery(StudentScope(studentId), filter, pagination)
            .ToPagedResultAsync(pagination, cancellationToken);

    public Task<PagedResult<Assignment>> GetPagedForAdminAsync(
        AssignmentFilter filter,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default) =>
        BuildQuery(_context.Assignments, filter, pagination)
            .ToPagedResultAsync(pagination, cancellationToken);

    public Task<bool> HasSubmissionsAsync(Guid assignmentId, CancellationToken cancellationToken = default) =>
        _context.Submissions.AnyAsync(s => s.AssignmentId == assignmentId, cancellationToken);

    public async Task AddAsync(Assignment assignment, CancellationToken cancellationToken = default) =>
        await _context.Assignments.AddAsync(assignment, cancellationToken);

    public void Remove(Assignment assignment) => _context.Assignments.Remove(assignment);

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    // Rules 3 + 6 as a single reusable predicate, so the student's by-id lookup and their list
    // cannot drift apart — the one place a draft could leak is the one place both go through.
    // The enrollment check is a subquery rather than a join: a join would duplicate an assignment
    // row if a student were ever enrolled in the same class twice.
    private IQueryable<Assignment> StudentScope(Guid studentId) =>
        _context.Assignments
            .Where(a => a.Status == AssignmentStatus.Published)
            .Where(a => _context.StudentEnrollments
                .Any(e => e.StudentId == studentId && e.ClassId == a.ClassId));

    private static IQueryable<Assignment> BuildQuery(
        IQueryable<Assignment> scoped,
        AssignmentFilter filter,
        PaginationQuery pagination)
    {
        if (filter.ClassId is { } classId)
        {
            scoped = scoped.Where(a => a.ClassId == classId);
        }

        if (filter.SubjectId is { } subjectId)
        {
            scoped = scoped.Where(a => a.SubjectId == subjectId);
        }

        if (filter.Status is { } status)
        {
            scoped = scoped.Where(a => a.Status == status);
        }

        return ApplySort(scoped.Include(a => a.Class).Include(a => a.Subject).AsNoTracking(), pagination);
    }

    // An allow-list, not reflection over the raw sortBy string: an arbitrary property name from the
    // query string would be both a crash and a way to probe the schema.
    // Every branch ends on Id so ties break deterministically — two assignments sharing a deadline
    // otherwise have no defined order, and page 2 can repeat a row already shown on page 1.
    private static IQueryable<Assignment> ApplySort(IQueryable<Assignment> query, PaginationQuery pagination)
    {
        var descending = pagination.SortDescending;

        return pagination.SortBy?.ToLowerInvariant() switch
        {
            "deadline" => descending
                ? query.OrderByDescending(a => a.Deadline).ThenBy(a => a.Id)
                : query.OrderBy(a => a.Deadline).ThenBy(a => a.Id),
            "title" => descending
                ? query.OrderByDescending(a => a.Title).ThenBy(a => a.Id)
                : query.OrderBy(a => a.Title).ThenBy(a => a.Id),
            _ => descending
                ? query.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Id)
                : query.OrderBy(a => a.CreatedAt).ThenBy(a => a.Id)
        };
    }
}
