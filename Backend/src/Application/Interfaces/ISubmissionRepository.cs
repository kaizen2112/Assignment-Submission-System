using AssignmentSystem.Application.Common;
using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Interfaces;

public interface ISubmissionRepository
{
    // Loads the parent Assignment with it: grading needs MaxMarks (rule 5) and updating needs
    // Deadline (rule 2), so every caller would otherwise immediately fetch it separately.
    Task<Submission?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    // Rule 3: the student path always filters on StudentId, so one student can never load another's
    // submission. Null here means 404, not 403 (assumption A7).
    Task<Submission?> GetByAssignmentAndStudentAsync(
        Guid assignmentId,
        Guid studentId,
        CancellationToken cancellationToken = default);

    // Assumption A4: one submission per student per assignment. Checked before insert so a second
    // attempt returns 409 rather than tripping the unique index.
    Task<bool> ExistsForAssignmentAndStudentAsync(
        Guid assignmentId,
        Guid studentId,
        CancellationToken cancellationToken = default);

    // Teacher view of one assignment's submissions. Includes Student, since a list of submissions
    // without names is useless to the person grading them.
    Task<PagedResult<Submission>> GetPagedForAssignmentAsync(
        Guid assignmentId,
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    Task<PagedResult<Submission>> GetPagedForAdminAsync(
        PaginationQuery pagination,
        CancellationToken cancellationToken = default);

    Task AddAsync(Submission submission, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
