using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.DTOs.Submission;

namespace AssignmentSystem.Application.Interfaces;

// assignmentId is on every method because docs/04 nests these routes under the assignment. It is not
// decoration: each method checks the submission really belongs to that assignment, so a valid
// submission id under the wrong assignment cannot be reached by editing the URL.
public interface ISubmissionService
{
    // Teacher view of one assignment's submissions.
    Task<Result<PagedResult<SubmissionResponse>>> GetPagedForAssignmentAsync(
        Guid assignmentId,
        PagedQueryParameters query,
        CancellationToken cancellationToken = default);

    Task<Result<SubmissionResponse>> SubmitAsync(
        Guid assignmentId,
        SubmitAnswerRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<SubmissionResponse>> GetMineAsync(
        Guid assignmentId,
        CancellationToken cancellationToken = default);

    Task<Result<SubmissionResponse>> UpdateMineAsync(
        Guid assignmentId,
        SubmitAnswerRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<SubmissionResponse>> GradeAsync(
        Guid assignmentId,
        Guid submissionId,
        GradeSubmissionRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<SubmissionResponse>> ChangeStatusAsync(
        Guid assignmentId,
        Guid submissionId,
        ChangeSubmissionStatusRequest request,
        CancellationToken cancellationToken = default);
}
