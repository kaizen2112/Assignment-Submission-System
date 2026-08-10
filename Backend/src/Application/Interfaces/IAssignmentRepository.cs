using AssignmentSystem.Application.Common;
using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Interfaces;

public interface IAssignmentRepository
{
    // Unscoped: returns drafts and other teachers' work. Callers must apply rule 4 (ownership) and
    // rule 6 (draft visibility) themselves. Used for mutations and for the teacher/admin read path.
    Task<Assignment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    // The student read path, with rules 3 and 6 baked into the query: Published only, and only for
    // classes the student is enrolled in. Returns null for a draft or an unenrolled class so the
    // caller answers 404 — never 403, which would confirm the assignment exists (assumption A7).
    Task<Assignment?> GetPublishedForStudentAsync(
        Guid id,
        Guid studentId,
        CancellationToken cancellationToken = default);

    // Teacher listing: everything they created, any status (docs/04 scoping table).
    Task<PagedResult<Assignment>> GetPagedForTeacherAsync(
        Guid teacherId,
        AssignmentFilter filter,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    // Student listing: Published only, enrolled classes only (rules 3 and 6).
    Task<PagedResult<Assignment>> GetPagedForStudentAsync(
        Guid studentId,
        AssignmentFilter filter,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    // Admin listing: no scoping at all, which is why it is a separate method rather than a nullable
    // teacherId on the teacher one — an accidental null can then never turn into "see everything".
    Task<PagedResult<Assignment>> GetPagedForAdminAsync(
        AssignmentFilter filter,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    // Assumption A5: an assignment with submissions cannot be deleted. Checked explicitly so the
    // service can return a readable 409, instead of letting the FK surface as a DbUpdateException.
    Task<bool> HasSubmissionsAsync(Guid assignmentId, CancellationToken cancellationToken = default);

    Task AddAsync(Assignment assignment, CancellationToken cancellationToken = default);

    // Synchronous because EF's Remove only marks the tracked entity — the delete happens on save.
    void Remove(Assignment assignment);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
