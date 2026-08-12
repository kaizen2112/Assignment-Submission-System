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

    private static Result<PagedResult<EnrolledClassResponse>> Fail(string error, ErrorType errorType) =>
        Result<PagedResult<EnrolledClassResponse>>.Failure(error, errorType);
}
