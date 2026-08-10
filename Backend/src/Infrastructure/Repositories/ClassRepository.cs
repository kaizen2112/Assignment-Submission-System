using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Repositories;

public sealed class ClassRepository : IClassRepository
{
    private readonly AppDbContext _context;

    public ClassRepository(AppDbContext context) => _context = context;

    // Subjects included: the only reason to fetch a single class is to show or edit what is in it.
    public Task<Class?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Classes
            .Include(c => c.Subjects)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<PagedResult<Class>> GetPagedAsync(
        PaginationQuery pagination,
        CancellationToken cancellationToken = default) =>
        ApplySort(_context.Classes.Include(c => c.Subjects).AsNoTracking(), pagination)
            .ToPagedResultAsync(pagination, cancellationToken);

    // Case-insensitive: "10a" and "10A" are the same class code to a human, so treating them as
    // distinct would let two near-identical classes exist and confuse every later lookup.
    public Task<bool> CodeExistsAsync(string code, CancellationToken cancellationToken = default) =>
        _context.Classes.AnyAsync(c => EF.Functions.ILike(c.Code, code), cancellationToken);

    public async Task AddAsync(Class @class, CancellationToken cancellationToken = default) =>
        await _context.Classes.AddAsync(@class, cancellationToken);

    // --- Subjects -------------------------------------------------------------------------------

    public Task<Subject?> GetSubjectByIdAsync(
        Guid subjectId,
        CancellationToken cancellationToken = default) =>
        _context.Subjects.FirstOrDefaultAsync(s => s.Id == subjectId, cancellationToken);

    public Task<bool> SubjectExistsInClassAsync(
        Guid classId,
        string name,
        CancellationToken cancellationToken = default) =>
        // Scoped to the class on purpose: "Mathematics" in 10A and "Mathematics" in 10B are two
        // legitimate rows, so uniqueness is per class, not global.
        _context.Subjects.AnyAsync(
            s => s.ClassId == classId && EF.Functions.ILike(s.Name, name),
            cancellationToken);

    public async Task AddSubjectAsync(Subject subject, CancellationToken cancellationToken = default) =>
        await _context.Subjects.AddAsync(subject, cancellationToken);

    // --- Teacher assignments --------------------------------------------------------------------

    // Rule 4. All three columns are matched, not just teacher+subject: TeacherAssignment carries
    // ClassId precisely so this gate resolves in one indexed lookup with no join.
    public Task<bool> TeacherAssignmentExistsAsync(
        Guid teacherId,
        Guid classId,
        Guid subjectId,
        CancellationToken cancellationToken = default) =>
        _context.TeacherAssignments.AnyAsync(
            ta => ta.TeacherId == teacherId && ta.ClassId == classId && ta.SubjectId == subjectId,
            cancellationToken);

    public async Task AddTeacherAssignmentAsync(
        TeacherAssignment teacherAssignment,
        CancellationToken cancellationToken = default) =>
        await _context.TeacherAssignments.AddAsync(teacherAssignment, cancellationToken);

    // --- Student enrollments --------------------------------------------------------------------

    // Rule 3. Returns ids rather than entities: callers only ever use these to scope another query.
    // No AsNoTracking needed — a projection to a scalar produces nothing for EF to track.
    public async Task<IReadOnlyList<Guid>> GetEnrolledClassIdsAsync(
        Guid studentId,
        CancellationToken cancellationToken = default) =>
        await _context.StudentEnrollments
            .Where(e => e.StudentId == studentId)
            .Select(e => e.ClassId)
            .ToListAsync(cancellationToken);

    public Task<bool> EnrollmentExistsAsync(
        Guid studentId,
        Guid classId,
        CancellationToken cancellationToken = default) =>
        _context.StudentEnrollments.AnyAsync(
            e => e.StudentId == studentId && e.ClassId == classId,
            cancellationToken);

    public async Task AddEnrollmentAsync(
        StudentEnrollment enrollment,
        CancellationToken cancellationToken = default) =>
        await _context.StudentEnrollments.AddAsync(enrollment, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    private static IQueryable<Class> ApplySort(IQueryable<Class> query, PaginationQuery pagination)
    {
        var descending = pagination.SortDescending;

        return pagination.SortBy?.ToLowerInvariant() switch
        {
            "name" => descending
                ? query.OrderByDescending(c => c.Name).ThenBy(c => c.Id)
                : query.OrderBy(c => c.Name).ThenBy(c => c.Id),
            "code" => descending
                ? query.OrderByDescending(c => c.Code).ThenBy(c => c.Id)
                : query.OrderBy(c => c.Code).ThenBy(c => c.Id),
            _ => descending
                ? query.OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Id)
                : query.OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
        };
    }
}
