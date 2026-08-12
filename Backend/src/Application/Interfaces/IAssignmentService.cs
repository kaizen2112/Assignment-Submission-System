using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;

namespace AssignmentSystem.Application.Interfaces;

// Every method resolves the caller from ICurrentUserService rather than taking a userId parameter.
// A controller cannot then pass someone else's id, by accident or otherwise.
public interface IAssignmentService
{
    // Scoped by the caller's role: teacher -> own (any status), student -> published in their
    // enrolled classes, admin -> everything.
    Task<Result<PagedResult<AssignmentListItemResponse>>> GetPagedAsync(
        AssignmentQueryParameters query,
        CancellationToken cancellationToken = default);

    Task<Result<AssignmentResponse>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    // Copies an assignment the caller owns into a fresh Draft. Takes no teacherId parameter, deliberately:
    // the caller comes from the token like everywhere else in this service, so there is no id to supply and
    // therefore no way to create work in somebody else's name.
    Task<Result<AssignmentResponse>> DuplicateAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<Result<AssignmentResponse>> CreateAsync(
        CreateAssignmentRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AssignmentResponse>> UpdateAsync(
        Guid id,
        UpdateAssignmentRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<AssignmentResponse>> PublishAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    // The class+subject pairs the calling teacher may create an assignment for. Lives here rather than
    // on a class service because its only purpose is to populate CreateAssignmentRequest's ClassId and
    // SubjectId — it is the read side of the same rule-4 gate CreateAsync enforces.
    Task<Result<PagedResult<TeachingScopeResponse>>> GetTeachingScopeAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default);
}
