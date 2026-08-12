using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Class;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Services;

// A student's own enrolments. One method, and the scoping is the whole point of it existing: the student id
// is taken from the token rather than accepted as a parameter, so this cannot be pointed at anyone else.
public sealed class ClassService : IClassService
{
    private readonly IClassRepository _classes;
    private readonly ICurrentUserService _currentUser;

    public ClassService(IClassRepository classes, ICurrentUserService currentUser)
    {
        _classes = classes;
        _currentUser = currentUser;
    }

    public async Task<Result<PagedResult<EnrolledClassResponse>>> GetMyClassesAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        if (_currentUser.UserId is not { } studentId ||
            !Enum.TryParse<Role>(_currentUser.Role, ignoreCase: false, out var role))
        {
            return Fail("Not authenticated.", ErrorType.Unauthorized);
        }

        // The controller's [Authorize(Roles = "Student")] has already refused anyone else; this is the
        // second lock, the same pattern every other service here follows. A teacher's equivalent question
        // is answered by their teaching scope, and an admin reads rosters class-by-class — so neither has
        // any business in a query keyed on "the enrolments belonging to me".
        if (role != Role.Student)
        {
            return Fail("Only a student has enrolled classes.", ErrorType.Forbidden);
        }

        var pagination = query.ToPagination();

        var check = pagination.Validate();
        if (!check.IsSuccess)
        {
            return Fail(check.Error!, check.ErrorType);
        }

        var page = await _classes.GetStudentEnrollmentsPagedAsync(studentId, pagination, cancellationToken);

        // An empty page is a real answer, not a 404: a student who has been created but not yet enrolled in
        // anything is a normal state during setup, and the dashboard needs to say so rather than error.
        return Result<PagedResult<EnrolledClassResponse>>.Success(page.Map(e =>
            new EnrolledClassResponse(e.ClassId, e.Class.Name, e.Class.Code, e.EnrolledAt)));
    }

    public async Task<Result<PagedResult<ClassmateResponse>>> GetClassmatesAsync(
        Guid classId,
        PagedQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        if (_currentUser.UserId is not { } studentId ||
            !Enum.TryParse<Role>(_currentUser.Role, ignoreCase: false, out var role))
        {
            return Result<PagedResult<ClassmateResponse>>.Failure(
                "Not authenticated.", ErrorType.Unauthorized);
        }

        if (role != Role.Student)
        {
            return Result<PagedResult<ClassmateResponse>>.Failure(
                "Only a student has classmates.", ErrorType.Forbidden);
        }

        var pagination = query.ToPagination();

        var check = pagination.Validate();
        if (!check.IsSuccess)
        {
            return Result<PagedResult<ClassmateResponse>>.Failure(check.Error!, check.ErrorType);
        }

        // The gate. Unlike GetMyClassesAsync, this takes a class id, so the id has to be *earned* rather than
        // trusted — a student not enrolled here gets 404 and learns nothing about whether the class exists
        // (assumption A7, the same reasoning as an unenrolled student reading an assignment).
        //
        // Checked before the roster is fetched, not after: a service that read the rows and then decided
        // would have the whole roster in memory beside a refusal.
        if (!await _classes.EnrollmentExistsAsync(studentId, classId, cancellationToken))
        {
            return Result<PagedResult<ClassmateResponse>>.Failure(
                "Class not found.", ErrorType.NotFound);
        }

        var page = await _classes.GetClassEnrollmentsPagedAsync(classId, pagination, cancellationToken);

        // The caller is included rather than filtered out. A roster with a hole where you should be reads as
        // a bug, and "(you)" is more use than an absence — it also lets the count match what a teacher sees.
        return Result<PagedResult<ClassmateResponse>>.Success(page.Map(e =>
            new ClassmateResponse(
                e.StudentId,
                e.Student.FullName,
                e.Student.Email,
                IsYou: e.StudentId == studentId)));
    }

    private static Result<PagedResult<EnrolledClassResponse>> Fail(string error, ErrorType errorType) =>
        Result<PagedResult<EnrolledClassResponse>>.Failure(error, errorType);
}
