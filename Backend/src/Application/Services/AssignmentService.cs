using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
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
    private readonly IUserRepository _users;
    private readonly ICurrentUserService _currentUser;

    public AssignmentService(
        IAssignmentRepository assignments,
        IClassRepository classes,
        IUserRepository users,
        ICurrentUserService currentUser)
    {
        _assignments = assignments;
        _classes = classes;
        _users = users;
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

        // Completion figures are for the people who act on them. A student is excluded here rather than in
        // the UI: how many of their classmates have submitted is information about other people, and
        // sending it down to be hidden client-side leaves it in plain sight in the network tab.
        //
        // Skipping the query for a student is the other half of that — no wasted work, and no code path
        // where the numbers exist in memory next to a student's response.
        if (caller.Role == Role.Student)
        {
            return Result<PagedResult<AssignmentListItemResponse>>.Success(page.Map(ToListItem));
        }

        // One call for the whole page. The single-assignment overload in a loop would be three queries per
        // row on the busiest teacher screen in the app.
        var completion = await _assignments.GetCompletionStatsAsync(
            page.Items.Select(a => a.Id).ToList(), cancellationToken);

        return Result<PagedResult<AssignmentListItemResponse>>.Success(
            page.Map(a => ToListItem(a) with { Completion = completion.GetValueOrDefault(a.Id) }));
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

        // Teacher or admin only, same reasoning as the list above: the student branch returned before
        // reaching here, so a student's response leaves Completion null and this query never runs.
        var completion = await _assignments.GetCompletionStatsAsync(id, cancellationToken);

        return Result<AssignmentResponse>.Success(ToResponse(assignment) with { Completion = completion });
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
        //
        // The author is the caller, so their name is the one thing not already in hand — the token carries
        // a user id and a role, not a display name. Looked up rather than re-reading the assignment through
        // the repository, which would pull Class and Subject back a second time for a name we already know
        // belongs to this caller. Same reason CommentService fetches the author after an insert.
        var teacher = await _users.GetByIdAsync(caller.UserId, cancellationToken);

        // Attached for the same reason as in DuplicateAsync: a null Completion must mean "withheld from a
        // student" and nothing else. A newly created assignment has 0 of N submitted, which is a real answer.
        var completion = await _assignments.GetCompletionStatsAsync(assignment.Id, cancellationToken);

        return Result<AssignmentResponse>.Success(
            ToResponse(assignment, @class.Name, subject.Name, teacher?.FullName ?? string.Empty)
                with { Completion = completion });
    }

    // How long a duplicate's deadline sits in the future before the teacher sets a real one. A week is long
    // enough that the copy is never born overdue, and near enough that an unedited one looks obviously
    // provisional rather than plausible.
    private const int DuplicateDeadlineDays = 7;

    public async Task<Result<AssignmentResponse>> DuplicateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        // The same gate that guards editing: LoadForMutationAsync checks the assignment exists, that the
        // caller created it, and that they still hold the class+subject grant (rule 4). Reused rather than
        // rewritten, because "may this teacher act on this assignment?" must have one answer — a second
        // implementation is a second thing to keep in step.
        //
        // Note what that means: a teacher who has been moved off a class can no longer duplicate their own
        // old assignment into it, which is correct. Duplicating creates new work in that class+subject, so
        // it needs the same authority as creating it from scratch.
        if (ResolveCaller() is not { } caller)
        {
            return Result<AssignmentResponse>.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        var authorized = await LoadForMutationAsync(id, cancellationToken);
        if (!authorized.IsSuccess)
        {
            return Result<AssignmentResponse>.Failure(authorized.Error!, authorized.ErrorType);
        }

        var original = authorized.Value;

        // Create takes no status and always produces a Draft, so a copy cannot be born visible to students
        // — the deadline is a placeholder and publishing one unreviewed would be the bug this guards.
        //
        // Nothing else is carried over. Submissions, grades and the comment thread all belong to the
        // original: they are a record of what particular students did, and a copy of an assignment is a new
        // piece of work nobody has answered yet. There is no code here to *avoid* copying them, which is the
        // point of building from the factory rather than cloning the entity.
        var copy = AssignmentEntity.Create(
            $"Copy of {original.Title}",
            original.Description,
            DateTime.UtcNow.AddDays(DuplicateDeadlineDays),
            original.MaxMarks,
            original.ClassId,
            original.SubjectId,
            // The caller, not original.CreatedByTeacherId. They are the same person here — the ownership
            // check above guarantees it — but writing the caller says which of the two facts this field is.
            caller.UserId,
            original.AllowLateSubmission);

        await _assignments.AddAsync(copy, cancellationToken);
        await _assignments.SaveChangesAsync(cancellationToken);

        // Navigations are unpopulated on a freshly constructed entity, so the names come from the original
        // (same class, same subject, by construction) and the teacher from a lookup — as in CreateAsync.
        var teacher = await _users.GetByIdAsync(copy.CreatedByTeacherId, cancellationToken);

        // Completion is attached here as well as on the read paths, so `Completion == null` means exactly
        // one thing across the whole API: "the caller is a student and was not told". A field that also meant
        // "nobody computed it on this particular route" would leave a client unable to tell a withheld figure
        // from an absent one. It is a cheap pair of counts, and a brand-new copy has a real answer — nobody
        // has submitted, out of however many are enrolled.
        var completion = await _assignments.GetCompletionStatsAsync(copy.Id, cancellationToken);

        return Result<AssignmentResponse>.Success(ToResponse(
            copy,
            original.Class.Name,
            original.Subject.Name,
            teacher?.FullName ?? string.Empty) with { Completion = completion });
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

    public async Task<Result<PagedResult<TeachingScopeResponse>>> GetTeachingScopeAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result<PagedResult<TeachingScopeResponse>>.Failure(
                "Not authenticated.", ErrorType.Unauthorized);
        }

        // Teacher-only, and enforced here as well as by [Authorize(Roles = "Teacher")] on the action.
        // "Which classes do I teach?" is meaningless for the other two roles: an Admin manages teaching
        // assignments through /admin/teacher-assignments, and a Student has enrollments, not teaching.
        if (caller.Role != Role.Teacher)
        {
            return Result<PagedResult<TeachingScopeResponse>>.Failure(
                "Only teachers have a teaching scope.", ErrorType.Forbidden);
        }

        var pagination = query.ToPagination();

        var paginationCheck = pagination.Validate();
        if (!paginationCheck.IsSuccess)
        {
            return Result<PagedResult<TeachingScopeResponse>>.Failure(
                paginationCheck.Error!, paginationCheck.ErrorType);
        }

        // caller.UserId, never a parameter: this is the one query whose whole job is to say what the
        // *caller* may touch, so accepting a teacherId from outside would defeat it.
        var page = await _classes.GetTeachingScopePagedAsync(
            caller.UserId, pagination, cancellationToken);

        return Result<PagedResult<TeachingScopeResponse>>.Success(page.Map(ToTeachingScope));
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

    // Class, Subject and CreatedByTeacher are eager-loaded by every repository read, so these are already
    // in memory.
    private static AssignmentResponse ToResponse(AssignmentEntity a) =>
        ToResponse(a, a.Class.Name, a.Subject.Name, a.CreatedByTeacher.FullName);

    private static AssignmentResponse ToResponse(
        AssignmentEntity a,
        string className,
        string subjectName,
        string teacherName) =>
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
            teacherName,
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
            a.CreatedByTeacherId,
            a.CreatedByTeacher.FullName,
            a.CreatedAt);

    private static TeachingScopeResponse ToTeachingScope(TeacherAssignment ta) =>
        new(ta.ClassId, ta.Class.Name, ta.Class.Code, ta.SubjectId, ta.Subject.Name);
}
