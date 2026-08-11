using AssignmentSystem.Application.Common;
using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Interfaces;

// Covers the whole Class aggregate — Subjects, TeacherAssignments and StudentEnrollments have no
// life of their own outside a Class, so they are reached through here rather than through three
// more interfaces. docs/05 names an _enrollmentRepo and a _teacherAssignmentRepo in pseudo-code;
// those queries are the two marked "rule 3" and "rule 4" below.
public interface IClassRepository
{
    Task<Class?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PagedResult<Class>> GetPagedAsync(
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    // Code is the human-readable handle ("10A") and is unique — pre-checked so a duplicate returns
    // 409 with a sentence, not a raw constraint violation.
    Task<bool> CodeExistsAsync(string code, CancellationToken cancellationToken = default);

    Task AddAsync(Class @class, CancellationToken cancellationToken = default);

    // --- Subjects -------------------------------------------------------------------------------

    Task<Subject?> GetSubjectByIdAsync(Guid subjectId, CancellationToken cancellationToken = default);

    Task<bool> SubjectExistsInClassAsync(
        Guid classId,
        string name,
        CancellationToken cancellationToken = default);

    Task AddSubjectAsync(Subject subject, CancellationToken cancellationToken = default);

    // --- Teacher assignments --------------------------------------------------------------------

    // Rule 4, the teacher authorization gate. Every teacher mutation on an assignment or a grade
    // passes through this before touching anything.
    Task<bool> TeacherAssignmentExistsAsync(
        Guid teacherId,
        Guid classId,
        Guid subjectId,
        CancellationToken cancellationToken = default);

    // The listing counterpart to TeacherAssignmentExistsAsync above. That one answers "may this teacher
    // touch this class+subject?"; this one answers "which pairs may they touch at all?" — which a
    // teacher had no way to discover before, leaving the create-assignment form with nothing to put in
    // its pickers and a brand-new teacher unable to create anything. Includes Class and Subject, since
    // every caller needs the names rather than bare ids.
    Task<PagedResult<TeacherAssignment>> GetTeachingScopePagedAsync(
        Guid teacherId,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    Task AddTeacherAssignmentAsync(
        TeacherAssignment teacherAssignment,
        CancellationToken cancellationToken = default);

    // --- Student enrollments --------------------------------------------------------------------

    // Rule 3, the student scoping gate.
    Task<IReadOnlyList<Guid>> GetEnrolledClassIdsAsync(
        Guid studentId,
        CancellationToken cancellationToken = default);

    Task<bool> EnrollmentExistsAsync(
        Guid studentId,
        Guid classId,
        CancellationToken cancellationToken = default);

    Task AddEnrollmentAsync(
        StudentEnrollment enrollment,
        CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
