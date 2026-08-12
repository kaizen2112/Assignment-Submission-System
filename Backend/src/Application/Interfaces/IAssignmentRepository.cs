using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
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

    // --- Completion --------------------------------------------------------------------------------

    // "How many of the enrolled students have handed this in." Two counts, both from SQL: enrolments in
    // the assignment's class, and submissions against the assignment.
    //
    // Returns counts and not a percentage on purpose — CompletionStats derives that, where a unit test can
    // reach the arithmetic and where the zero-enrolment case is decided in code rather than by the
    // database. See the note on CompletionStats.Percentage.
    Task<CompletionStats> GetCompletionStatsAsync(
        Guid assignmentId,
        CancellationToken cancellationToken = default);

    // The same figures for a whole page of assignments, which is why this overload exists rather than the
    // list path calling the single one per row: that would be one pair of counts per assignment, an N+1 on
    // the busiest teacher screen in the app. This runs a fixed three queries whatever the page size.
    //
    // Assignments with no matching row come back with zeroes rather than being absent, so a caller never
    // has to decide what a missing key means.
    Task<IReadOnlyDictionary<Guid, CompletionStats>> GetCompletionStatsAsync(
        IReadOnlyCollection<Guid> assignmentIds,
        CancellationToken cancellationToken = default);

    Task AddAsync(Assignment assignment, CancellationToken cancellationToken = default);

    // Synchronous because EF's Remove only marks the tracked entity — the delete happens on save.
    void Remove(Assignment assignment);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
