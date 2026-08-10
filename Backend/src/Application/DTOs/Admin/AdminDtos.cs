using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.DTOs.Admin;

// --- Users ----------------------------------------------------------------------------------------

// Role travels as a string for the same reason submission status does: an unrecognised value becomes
// a 400 naming the three valid roles, not a model-binder error naming a .NET enum.
public sealed record CreateUserRequest(string FullName, string Email, string Password, string Role);

// NewPassword is optional. Without it an admin has no way to help a user who has forgotten theirs —
// there is no self-service reset endpoint anywhere in the system. Omit the field to leave the
// existing password untouched.
public sealed record UpdateUserRequest(string FullName, string Email, string Role, string? NewPassword = null);

// PasswordHash is absent by construction, not by filtering. A response DTO that never has the field
// cannot leak it, however carelessly it is mapped later.
public sealed record UserResponse(
    Guid Id,
    string FullName,
    string Email,
    string Role,
    DateTime CreatedAt);

public sealed class UserQueryParameters : PagedQueryParameters
{
    public Role? Role { get; set; }

    // Matches against full name or email, case-insensitive.
    public string? Search { get; set; }
}

// --- Classes and subjects -------------------------------------------------------------------------

public sealed record CreateClassRequest(string Name, string Code);

// ClassId comes from the route (/admin/classes/{id}/subjects), so it is not repeated in the body —
// two sources for one value is two chances for them to disagree.
public sealed record CreateSubjectRequest(string Name);

public sealed record SubjectResponse(Guid Id, string Name, Guid ClassId);

public sealed record ClassResponse(
    Guid Id,
    string Name,
    string Code,
    DateTime CreatedAt,
    IReadOnlyList<SubjectResponse> Subjects);

// --- Teacher assignments and enrollments ----------------------------------------------------------

public sealed record CreateTeacherAssignmentRequest(Guid TeacherId, Guid SubjectId, Guid ClassId);

public sealed record TeacherAssignmentResponse(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    Guid SubjectId,
    string SubjectName,
    Guid ClassId,
    string ClassName,
    DateTime AssignedAt);

public sealed record CreateEnrollmentRequest(Guid StudentId, Guid ClassId);

public sealed record EnrollmentResponse(
    Guid Id,
    Guid StudentId,
    string StudentName,
    Guid ClassId,
    string ClassName,
    DateTime EnrolledAt);
