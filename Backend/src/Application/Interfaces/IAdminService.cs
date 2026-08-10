using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Admin;
using AssignmentSystem.Application.DTOs.Common;

namespace AssignmentSystem.Application.Interfaces;

// Admin-only operations. Nothing here scopes by the caller, because an admin's whole purpose is to
// see and change everything — which is exactly why [Authorize(Roles = "Admin")] on the controller is
// the only thing standing in front of it (rule 7).
public interface IAdminService
{
    Task<Result<PagedResult<UserResponse>>> GetUsersAsync(
        UserQueryParameters query,
        CancellationToken cancellationToken = default);

    Task<Result<UserResponse>> CreateUserAsync(
        CreateUserRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<UserResponse>> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        CancellationToken cancellationToken = default);

    Task<Result> DeleteUserAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<PagedResult<ClassResponse>>> GetClassesAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default);

    Task<Result<ClassResponse>> CreateClassAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<SubjectResponse>> AddSubjectAsync(
        Guid classId,
        CreateSubjectRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<TeacherAssignmentResponse>> AssignTeacherAsync(
        CreateTeacherAssignmentRequest request,
        CancellationToken cancellationToken = default);

    Task<Result<EnrollmentResponse>> EnrollStudentAsync(
        CreateEnrollmentRequest request,
        CancellationToken cancellationToken = default);
}
