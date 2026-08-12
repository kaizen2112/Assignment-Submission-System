using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
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

    // Tracked, because callers mutate the result (Publish, update, delete). Class, Subject and the
    // authoring teacher come along because the detail response shows all three names.
    public Task<Assignment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Assignments
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.CreatedByTeacher)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public Task<Assignment?> GetPublishedForStudentAsync(
        Guid id,
        Guid studentId,
        CancellationToken cancellationToken = default) =>
        StudentScope(studentId)
            .Include(a => a.Class)
            .Include(a => a.Subject)
            .Include(a => a.CreatedByTeacher)
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

    // Two counts, no entity loaded. The enrolment count is keyed on the assignment's class rather than on
    // the assignment, because "who was supposed to do this" is a property of the class — a student enrolled
    // after the deadline still counts as somebody who has not submitted.
    //
    // The Status filter looks redundant and is kept anyway: in practice a submission row is only ever
    // created by SubmissionService.SubmitAsync, which never writes NotSubmitted. But NotSubmitted exists in
    // the enum, so a row could hold it, and a "submitted" count that included it would be wrong.
    public async Task<CompletionStats> GetCompletionStatsAsync(
        Guid assignmentId,
        CancellationToken cancellationToken = default)
    {
        var classId = await _context.Assignments
            .Where(a => a.Id == assignmentId)
            .Select(a => (Guid?)a.ClassId)
            .FirstOrDefaultAsync(cancellationToken);

        // No such assignment. Zeroes rather than a throw: the caller has already decided this id is
        // readable, and a race with a delete should not turn a read into a 500.
        if (classId is not { } resolvedClassId)
        {
            return new CompletionStats(0, 0);
        }

        var enrolled = await _context.StudentEnrollments
            .CountAsync(e => e.ClassId == resolvedClassId, cancellationToken);

        var submitted = await _context.Submissions
            .CountAsync(
                s => s.AssignmentId == assignmentId && s.Status != SubmissionStatus.NotSubmitted,
                cancellationToken);

        return new CompletionStats(enrolled, submitted);
    }

    // Three queries for the whole page: the assignments' class ids, one grouped enrolment count per class,
    // one grouped submission count per assignment. Calling the single-assignment overload per row would be
    // 3n queries on the teacher's list — the classic N+1, on the one screen that always shows twenty rows.
    //
    // Grouping in SQL rather than counting in memory: the alternative is transferring every enrolment and
    // every submission row to count them here, which is slow in exactly the way that looks fine with seed
    // data and falls over with a real school in it.
    public async Task<IReadOnlyDictionary<Guid, CompletionStats>> GetCompletionStatsAsync(
        IReadOnlyCollection<Guid> assignmentIds,
        CancellationToken cancellationToken = default)
    {
        if (assignmentIds.Count == 0)
        {
            return new Dictionary<Guid, CompletionStats>();
        }

        var ids = assignmentIds.Distinct().ToList();

        var scopes = await _context.Assignments
            .AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .Select(a => new { a.Id, a.ClassId })
            .ToListAsync(cancellationToken);

        var classIds = scopes.Select(s => s.ClassId).Distinct().ToList();

        var enrolledByClass = await _context.StudentEnrollments
            .Where(e => classIds.Contains(e.ClassId))
            .GroupBy(e => e.ClassId)
            .Select(g => new { ClassId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.ClassId, g => g.Count, cancellationToken);

        var submittedByAssignment = await _context.Submissions
            .Where(s => ids.Contains(s.AssignmentId) && s.Status != SubmissionStatus.NotSubmitted)
            .GroupBy(s => s.AssignmentId)
            .Select(g => new { AssignmentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.AssignmentId, g => g.Count, cancellationToken);

        // GroupBy omits empty groups, so a class with no enrolments and an assignment with no submissions
        // are both absent above. Defaulting to 0 here is what lets the caller treat every requested id as
        // present — "no submissions yet" is an answer, not a missing one.
        return scopes.ToDictionary(
            s => s.Id,
            s => new CompletionStats(
                enrolledByClass.GetValueOrDefault(s.ClassId),
                submittedByAssignment.GetValueOrDefault(s.Id)));
    }

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

        // CreatedByTeacher joins here as well as in the two by-id reads: every list row names the teacher
        // who set the work, and looking that up per row afterwards is the N+1 this Include exists to avoid.
        return ApplySort(
            scoped
                .Include(a => a.Class)
                .Include(a => a.Subject)
                .Include(a => a.CreatedByTeacher)
                .AsNoTracking(),
            pagination);
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
