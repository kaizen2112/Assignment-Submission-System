using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Enums;
using AssignmentEntity = AssignmentSystem.Domain.Entities.Assignment;

namespace AssignmentSystem.Application.Services;

public sealed class AssignmentService : IAssignmentService
{
    // One message for every rule-4 rejection. A teacher probing whether a class exists, whether a
    // subject exists in it, or who else teaches it learns nothing from the difference.
    private const string NotAssigned = "You are not assigned to this class and subject.";
    private const string NotOwner = "You can only modify assignments you created.";

    private readonly IAssignmentRepository _assignments;
    private readonly IClassRepository _classes;
    private readonly ICurrentUserService _currentUser;

    public AssignmentService(
        IAssignmentRepository assignments,
        IClassRepository classes,
        ICurrentUserService currentUser)
    {
        _assignments = assignments;
        _classes = classes;
        _currentUser = currentUser;
    }

    public async Task<Result<PagedResult<AssignmentListItemResponse>>> GetPagedAsync(
        AssignmentQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result<PagedResult<AssignmentListItemResponse>>.Failure(
                "Not authenticated.", ErrorType.Unauthorized);
        }

        var pagination = query.ToPagination();

        var paginationCheck = pagination.Validate();
        if (!paginationCheck.IsSuccess)
        {
            return Result<PagedResult<AssignmentListItemResponse>>.Failure(
                paginationCheck.Error!, paginationCheck.ErrorType);
        }

        var filter = query.ToFilter();

        // The role picks the repository method, and each method carries its own scoping. There is
        // deliberately no shared "get all then filter" path a new role could accidentally land on.
        var page = caller.Role switch
        {
            Role.Teacher => await _assignments.GetPagedForTeacherAsync(
                caller.UserId, filter, pagination, cancellationToken),
            Role.Student => await _assignments.GetPagedForStudentAsync(
                caller.UserId, filter, pagination, cancellationToken),
            _ => await _assignments.GetPagedForAdminAsync(filter, pagination, cancellationToken)
        };

        return Result<PagedResult<AssignmentListItemResponse>>.Success(page.Map(ToListItem));
    }

    public async Task<Result<AssignmentResponse>> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result<AssignmentResponse>.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        // Rules 3 and 6 for students: the repository returns null for a draft or for a class they
        // are not enrolled in, and that becomes a 404. Never 403 — that would confirm it exists (A7).
        if (caller.Role == Role.Student)
        {
            var visible = await _assignments.GetPublishedForStudentAsync(
                id, caller.UserId, cancellationToken);

            return visible is null
                ? NotFound()
                : Result<AssignmentResponse>.Success(ToResponse(visible));
        }

        var assignment = await _assignments.GetByIdAsync(id, cancellationToken);
        if (assignment is null)
        {
            return NotFound();
        }

        // A teacher's detail view matches their list view: their own work, any status (rule 6 lets
        // them see their own drafts). Another teacher's assignment reads as absent rather than
        // forbidden, keeping the two views from disagreeing about what exists.
        if (caller.Role == Role.Teacher && assignment.CreatedByTeacherId != caller.UserId)
        {
            return NotFound();
        }

        return Result<AssignmentResponse>.Success(ToResponse(assignment));
    }

    public async Task<Result<AssignmentResponse>> CreateAsync(
        CreateAssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result<AssignmentResponse>.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        var subject = await _classes.GetSubjectByIdAsync(request.SubjectId, cancellationToken);
        if (subject is null)
        {
            return Result<AssignmentResponse>.Failure("Subject not found.", ErrorType.NotFound);
        }

        // Without this the pair (classId, subjectId) could be mismatched — "Science" filed under
        // class 10A — and every later scoping query would disagree with itself.
        if (subject.ClassId != request.ClassId)
        {
            return Result<AssignmentResponse>.Failure(
                "The subject does not belong to the specified class.", ErrorType.Validation);
        }

        var @class = await _classes.GetByIdAsync(request.ClassId, cancellationToken);
        if (@class is null)
        {
            return Result<AssignmentResponse>.Failure("Class not found.", ErrorType.NotFound);
        }

        // Rule 4. Checked after existence so a genuine typo reads as 404 rather than 403.
        if (!await _classes.TeacherAssignmentExistsAsync(
                caller.UserId, request.ClassId, request.SubjectId, cancellationToken))
        {
            return Result<AssignmentResponse>.Failure(NotAssigned, ErrorType.Forbidden);
        }

        // Always born a Draft — Create takes no status, so rule 6 cannot be bypassed at creation.
        var assignment = AssignmentEntity.Create(
            request.Title.Trim(),
            request.Description.Trim(),
            request.DeadlineUtc,
            request.MaxMarks,
            request.ClassId,
            request.SubjectId,
            caller.UserId,
            request.AllowLateSubmission);

        await _assignments.AddAsync(assignment, cancellationToken);
        await _assignments.SaveChangesAsync(cancellationToken);

        // Mapped from the entities already in hand rather than re-reading: the navigation properties
        // are not populated on a freshly constructed entity.
        return Result<AssignmentResponse>.Success(ToResponse(assignment, @class.Name, subject.Name));
    }

    public async Task<Result<AssignmentResponse>> UpdateAsync(
        Guid id,
        UpdateAssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        var authorized = await LoadForMutationAsync(id, cancellationToken);
        if (!authorized.IsSuccess)
        {
            return Result<AssignmentResponse>.Failure(authorized.Error!, authorized.ErrorType);
        }

        var assignment = authorized.Value;

        // Only a *changed* deadline has to be in the future. Requiring it unconditionally would make
        // an overdue assignment permanently uneditable; allowing a past value freely would let a
        // teacher back-date a deadline and retroactively lock out students who still had time.
        if (assignment.Deadline != request.DeadlineUtc && request.DeadlineUtc <= DateTime.UtcNow)
        {
            return Result<AssignmentResponse>.Failure(
                "A new deadline must be in the future.", ErrorType.Validation);
        }

        assignment.Update(
            request.Title.Trim(),
            request.Description.Trim(),
            request.DeadlineUtc,
            request.MaxMarks,
            request.AllowLateSubmission);

        await _assignments.SaveChangesAsync(cancellationToken);

        return Result<AssignmentResponse>.Success(ToResponse(assignment));
    }

    public async Task<Result<AssignmentResponse>> PublishAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var authorized = await LoadForMutationAsync(id, cancellationToken);
        if (!authorized.IsSuccess)
        {
            return Result<AssignmentResponse>.Failure(authorized.Error!, authorized.ErrorType);
        }

        var assignment = authorized.Value;

        // Idempotent, matching the entity: re-publishing returns 200 with the same body rather than
        // a 409, which is the correct semantics for PATCH.
        assignment.Publish();
        await _assignments.SaveChangesAsync(cancellationToken);

        return Result<AssignmentResponse>.Success(ToResponse(assignment));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var authorized = await LoadForMutationAsync(id, cancellationToken);
        if (!authorized.IsSuccess)
        {
            return Result.Failure(authorized.Error!, authorized.ErrorType);
        }

        // Assumption A5. Asked rather than caught: submissions.AssignmentId cascades, so deleting
        // would silently destroy graded student work instead of failing.
        if (await _assignments.HasSubmissionsAsync(id, cancellationToken))
        {
            return Result.Failure(
                "This assignment has submissions and cannot be deleted.", ErrorType.Conflict);
        }

        _assignments.Remove(authorized.Value);
        await _assignments.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    // Update, publish and delete share one gate, so the three cannot drift apart on who is allowed
    // to do what. Ownership is checked before rule 4: docs/04 scopes these to "own only", and the
    // rule-4 re-check then catches a teacher whose assignment to the class was since revoked.
    private async Task<Result<AssignmentEntity>> LoadForMutationAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result<AssignmentEntity>.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        var assignment = await _assignments.GetByIdAsync(id, cancellationToken);
        if (assignment is null)
        {
            return Result<AssignmentEntity>.Failure("Assignment not found.", ErrorType.NotFound);
        }

        if (assignment.CreatedByTeacherId != caller.UserId)
        {
            return Result<AssignmentEntity>.Failure(NotOwner, ErrorType.Forbidden);
        }

        if (!await _classes.TeacherAssignmentExistsAsync(
                caller.UserId, assignment.ClassId, assignment.SubjectId, cancellationToken))
        {
            return Result<AssignmentEntity>.Failure(NotAssigned, ErrorType.Forbidden);
        }

        return Result<AssignmentEntity>.Success(assignment);
    }

    // Returns null when the token carried no usable sub/role. The controller's [Authorize] should
    // already have rejected that, so this is the second lock rather than the first.
    private (Guid UserId, Role Role)? ResolveCaller()
    {
        if (_currentUser.UserId is not { } userId)
        {
            return null;
        }

        return Enum.TryParse<Role>(_currentUser.Role, ignoreCase: false, out var role)
            ? (userId, role)
            : null;
    }

    private static Result<AssignmentResponse> NotFound() =>
        Result<AssignmentResponse>.Failure("Assignment not found.", ErrorType.NotFound);

    // Class and Subject are eager-loaded by every repository read, so these are already in memory.
    private static AssignmentResponse ToResponse(AssignmentEntity a) =>
        ToResponse(a, a.Class.Name, a.Subject.Name);

    private static AssignmentResponse ToResponse(AssignmentEntity a, string className, string subjectName) =>
        new(
            a.Id,
            a.Title,
            a.Description,
            a.Deadline,
            a.MaxMarks,
            a.Status.ToString(),
            a.AllowLateSubmission,
            // Computed per response rather than stored: "overdue" is a function of the current
            // clock, and a persisted flag would be wrong the moment nobody wrote to the row.
            a.Deadline <= DateTime.UtcNow,
            a.ClassId,
            className,
            a.SubjectId,
            subjectName,
            a.CreatedByTeacherId,
            a.CreatedAt,
            a.UpdatedAt);

    private static AssignmentListItemResponse ToListItem(AssignmentEntity a) =>
        new(
            a.Id,
            a.Title,
            a.Deadline,
            a.MaxMarks,
            a.Status.ToString(),
            a.AllowLateSubmission,
            a.Deadline <= DateTime.UtcNow,
            a.ClassId,
            a.Class.Name,
            a.SubjectId,
            a.Subject.Name,
            a.CreatedAt);
}
