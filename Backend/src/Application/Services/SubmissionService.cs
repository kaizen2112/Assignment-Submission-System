using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.DTOs.Submission;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Enums;
using SubmissionEntity = AssignmentSystem.Domain.Entities.Submission;

namespace AssignmentSystem.Application.Services;

public sealed class SubmissionService : ISubmissionService
{
    private const string NotAssigned = "You are not assigned to this class and subject.";
    private const string NotFoundMessage = "Submission not found.";

    // Rule 8, as the transition table docs/05 specifies. The value is not redundant: docs/05 lists
    // three transitions as explicitly forbidden with a reason, and holding them as `false` lets the
    // rejection say *why* ("cannot un-grade") instead of emitting one generic message for both a
    // forbidden move and a nonsensical one. Anything absent is rejected too.
    //
    // NotSubmitted appears nowhere on purpose: no row exists until a student submits, so it is a
    // conceptual state before the aggregate, not one this table can be asked to leave or reach.
    private static readonly Dictionary<(SubmissionStatus From, SubmissionStatus To), bool> Transitions = new()
    {
        // A re-submitted answer keeps its status (docs/05: "Submitted -> Submitted, status stays"),
        // which also makes PATCH /status idempotent.
        [(SubmissionStatus.Submitted, SubmissionStatus.Submitted)] = true,
        [(SubmissionStatus.Late, SubmissionStatus.Late)] = true,

        [(SubmissionStatus.Submitted, SubmissionStatus.Graded)] = true,
        [(SubmissionStatus.Late, SubmissionStatus.Graded)] = true,

        // Re-grading is allowed. Not in docs/05's table, but a teacher who types 8 instead of 85
        // must be able to correct it, and assumption A1 locks the *student* out of a graded
        // submission, not the teacher.
        [(SubmissionStatus.Graded, SubmissionStatus.Graded)] = true,

        // The forbidden rows from docs/05.
        [(SubmissionStatus.Graded, SubmissionStatus.Submitted)] = false,
        [(SubmissionStatus.Graded, SubmissionStatus.Late)] = false
    };

    private readonly ISubmissionRepository _submissions;
    private readonly IAssignmentRepository _assignments;
    private readonly IClassRepository _classes;
    private readonly IUserRepository _users;
    private readonly ICurrentUserService _currentUser;

    public SubmissionService(
        ISubmissionRepository submissions,
        IAssignmentRepository assignments,
        IClassRepository classes,
        IUserRepository users,
        ICurrentUserService currentUser)
    {
        _submissions = submissions;
        _assignments = assignments;
        _classes = classes;
        _users = users;
        _currentUser = currentUser;
    }

    public async Task<Result<PagedResult<SubmissionResponse>>> GetPagedForAssignmentAsync(
        Guid assignmentId,
        PagedQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<PagedResult<SubmissionResponse>>("Not authenticated.", ErrorType.Unauthorized);
        }

        var pagination = query.ToPagination();

        var paginationCheck = pagination.Validate();
        if (!paginationCheck.IsSuccess)
        {
            return Fail<PagedResult<SubmissionResponse>>(paginationCheck.Error!, paginationCheck.ErrorType);
        }

        var access = await AuthorizeTeacherOnAssignmentAsync(assignmentId, caller, cancellationToken);
        if (!access.IsSuccess)
        {
            return Fail<PagedResult<SubmissionResponse>>(access.Error!, access.ErrorType);
        }

        var page = await _submissions.GetPagedForAssignmentAsync(assignmentId, pagination, cancellationToken);

        return Result<PagedResult<SubmissionResponse>>.Success(
            page.Map(s => ToResponse(s, access.Value.Title, access.Value.MaxMarks)));
    }

    public async Task<Result<PagedResult<SubmissionResponse>>> GetAllForAdminAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        var pagination = query.ToPagination();

        var paginationCheck = pagination.Validate();
        if (!paginationCheck.IsSuccess)
        {
            return Fail<PagedResult<SubmissionResponse>>(paginationCheck.Error!, paginationCheck.ErrorType);
        }

        // No role branch and no scoping: the repository query eager-loads Assignment and Student, so
        // the standard mapper works and every row is returned as-is.
        var page = await _submissions.GetPagedForAdminAsync(pagination, cancellationToken);

        return Result<PagedResult<SubmissionResponse>>.Success(page.Map(ToResponse));
    }

    public async Task<Result<SubmissionResponse>> SubmitAsync(
        Guid assignmentId,
        SubmitAnswerRequest request,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<SubmissionResponse>("Not authenticated.", ErrorType.Unauthorized);
        }

        // Rules 3 and 6 in one call: an assignment that is still a draft, or belongs to a class the
        // student is not enrolled in, comes back null and reads as 404. A student therefore cannot
        // submit to work that was never shared with them.
        var assignment = await _assignments.GetPublishedForStudentAsync(
            assignmentId, caller.UserId, cancellationToken);

        if (assignment is null)
        {
            return Fail<SubmissionResponse>("Assignment not found.", ErrorType.NotFound);
        }

        // Assumption A4: one submission per student per assignment. Checked before insert so this is
        // a 409 with a sentence rather than a unique-index violation.
        if (await _submissions.ExistsForAssignmentAndStudentAsync(
                assignmentId, caller.UserId, cancellationToken))
        {
            return Fail<SubmissionResponse>(
                "You have already submitted for this assignment. Update your submission instead.",
                ErrorType.Conflict);
        }

        // Rule 1. Lateness is decided here, once, and handed to the factory — Submission.Create then
        // derives Status from it, so a late arrival can never be recorded as an on-time one.
        var isPastDeadline = DateTime.UtcNow > assignment.Deadline;

        if (isPastDeadline && !assignment.AllowLateSubmission)
        {
            return Fail<SubmissionResponse>("Submission deadline has passed.", ErrorType.Validation);
        }

        var submission = SubmissionEntity.Create(
            assignmentId, caller.UserId, request.AnswerText.Trim(), isPastDeadline);

        await _submissions.AddAsync(submission, cancellationToken);
        await _submissions.SaveChangesAsync(cancellationToken);

        // The navigation properties are empty on a freshly constructed entity, so the student's name
        // is fetched rather than read off submission.Student.
        var student = await _users.GetByIdAsync(caller.UserId, cancellationToken);

        return Result<SubmissionResponse>.Success(ToResponse(
            submission, assignment.Title, assignment.MaxMarks, student?.FullName ?? string.Empty));
    }

    public async Task<Result<SubmissionResponse>> GetMineAsync(
        Guid assignmentId,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<SubmissionResponse>("Not authenticated.", ErrorType.Unauthorized);
        }

        // Rule 3: the repository always filters on StudentId, so this can only ever return the
        // caller's own row. There is no code path here that could read someone else's.
        var submission = await _submissions.GetByAssignmentAndStudentAsync(
            assignmentId, caller.UserId, cancellationToken);

        return submission is null
            ? Fail<SubmissionResponse>(NotFoundMessage, ErrorType.NotFound)
            : Result<SubmissionResponse>.Success(ToResponse(submission));
    }

    public async Task<Result<SubmissionResponse>> UpdateMineAsync(
        Guid assignmentId,
        SubmitAnswerRequest request,
        CancellationToken cancellationToken = default)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Fail<SubmissionResponse>("Not authenticated.", ErrorType.Unauthorized);
        }

        var submission = await _submissions.GetByAssignmentAndStudentAsync(
            assignmentId, caller.UserId, cancellationToken);

        if (submission is null)
        {
            return Fail<SubmissionResponse>(NotFoundMessage, ErrorType.NotFound);
        }

        // Rule 2, in the order docs/05 states it. The deadline check has no AllowLateSubmission
        // exception on purpose: that flag buys a student one late delivery, not an open editing
        // window afterwards.
        if (DateTime.UtcNow > submission.Assignment.Deadline)
        {
            return Fail<SubmissionResponse>(
                "Cannot update submission after the deadline.", ErrorType.Validation);
        }

        // Rule 2 second half, and assumption A1: grading is final for the student. Reached only in
        // the edge case of a submission graded before its deadline.
        if (submission.Status == SubmissionStatus.Graded)
        {
            return Fail<SubmissionResponse>(
                "Cannot update a graded submission.", ErrorType.Validation);
        }

        submission.Update(request.AnswerText.Trim());
        await _submissions.SaveChangesAsync(cancellationToken);

        return Result<SubmissionResponse>.Success(ToResponse(submission));
    }

    public async Task<Result<SubmissionResponse>> GradeAsync(
        Guid assignmentId,
        Guid submissionId,
        GradeSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        var loaded = await LoadForTeacherAsync(assignmentId, submissionId, cancellationToken);
        if (!loaded.IsSuccess)
        {
            return Fail<SubmissionResponse>(loaded.Error!, loaded.ErrorType);
        }

        var submission = loaded.Value;

        // Rule 8 guards the grading path too: Submitted/Late -> Graded is allowed, and Graded ->
        // Graded permits a correction. One table, so grading and the status endpoint cannot disagree.
        var transition = CheckTransition(submission.Status, SubmissionStatus.Graded);
        if (!transition.IsSuccess)
        {
            return Fail<SubmissionResponse>(transition.Error!, transition.ErrorType);
        }

        // Rule 5. The validator already rejected a negative value; this is the safety net docs/05
        // asks for, and the upper bound can only be checked here because it is the parent
        // assignment's MaxMarks.
        if (request.Marks < 0)
        {
            return Fail<SubmissionResponse>("Marks cannot be negative.", ErrorType.Validation);
        }

        if (request.Marks > submission.Assignment.MaxMarks)
        {
            return Fail<SubmissionResponse>(
                $"Marks cannot exceed the maximum of {submission.Assignment.MaxMarks}.",
                ErrorType.Validation);
        }

        submission.Grade(request.Marks, request.Feedback?.Trim());
        await _submissions.SaveChangesAsync(cancellationToken);

        return Result<SubmissionResponse>.Success(ToResponse(submission));
    }

    public async Task<Result<SubmissionResponse>> ChangeStatusAsync(
        Guid assignmentId,
        Guid submissionId,
        ChangeSubmissionStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        var loaded = await LoadForTeacherAsync(assignmentId, submissionId, cancellationToken);
        if (!loaded.IsSuccess)
        {
            return Fail<SubmissionResponse>(loaded.Error!, loaded.ErrorType);
        }

        // The validator has already confirmed the string names a real status, so this parse cannot
        // fail in practice; the guard is here because the service must not trust having been called
        // through the filter.
        if (!Enum.TryParse<SubmissionStatus>(request.Status, ignoreCase: false, out var target))
        {
            return Fail<SubmissionResponse>(
                $"'{request.Status}' is not a valid submission status.", ErrorType.Validation);
        }

        var submission = loaded.Value;

        var transition = CheckTransition(submission.Status, target);
        if (!transition.IsSuccess)
        {
            return Fail<SubmissionResponse>(transition.Error!, transition.ErrorType);
        }

        submission.ChangeStatus(target);
        await _submissions.SaveChangesAsync(cancellationToken);

        return Result<SubmissionResponse>.Success(ToResponse(submission));
    }

    // Rule 8's single decision point.
    private static Result CheckTransition(SubmissionStatus from, SubmissionStatus to)
    {
        if (Transitions.TryGetValue((from, to), out var allowed) && allowed)
        {
            return Result.Success();
        }

        // A recorded `false` is a rule with a reason behind it, so it gets the specific message.
        if (from == SubmissionStatus.Graded)
        {
            return Result.Failure(
                "A graded submission cannot be un-graded.", ErrorType.Validation);
        }

        return Result.Failure(
            $"A submission cannot move from {from} to {to}.", ErrorType.Validation);
    }

    // Shared by grade and status-change. Note the submission is matched against the assignment in
    // the route: a real submission id nested under the wrong assignment reads as absent, so the URL
    // cannot be edited into someone else's assignment.
    private async Task<Result<SubmissionEntity>> LoadForTeacherAsync(
        Guid assignmentId,
        Guid submissionId,
        CancellationToken cancellationToken)
    {
        if (ResolveCaller() is not { } caller)
        {
            return Result<SubmissionEntity>.Failure("Not authenticated.", ErrorType.Unauthorized);
        }

        var submission = await _submissions.GetByIdAsync(submissionId, cancellationToken);

        if (submission is null || submission.AssignmentId != assignmentId)
        {
            return Result<SubmissionEntity>.Failure(NotFoundMessage, ErrorType.NotFound);
        }

        // Rule 4, against the assignment's class and subject. Deliberately *not* an authorship check,
        // unlike editing an assignment: docs/05 scopes grading to "an assignment in their class", and
        // a teacher newly assigned to a subject must be able to grade work already submitted to it.
        if (caller.Role == Role.Teacher &&
            !await _classes.TeacherAssignmentExistsAsync(
                caller.UserId,
                submission.Assignment.ClassId,
                submission.Assignment.SubjectId,
                cancellationToken))
        {
            return Result<SubmissionEntity>.Failure(NotAssigned, ErrorType.Forbidden);
        }

        return Result<SubmissionEntity>.Success(submission);
    }

    // The teacher-side list gate. Returns the assignment, since its title and MaxMarks are needed to
    // render every row and the entities themselves carry no loaded parent.
    private async Task<Result<Domain.Entities.Assignment>> AuthorizeTeacherOnAssignmentAsync(
        Guid assignmentId,
        (Guid UserId, Role Role) caller,
        CancellationToken cancellationToken)
    {
        var assignment = await _assignments.GetByIdAsync(assignmentId, cancellationToken);

        if (assignment is null)
        {
            return Result<Domain.Entities.Assignment>.Failure(
                "Assignment not found.", ErrorType.NotFound);
        }

        if (caller.Role == Role.Teacher &&
            !await _classes.TeacherAssignmentExistsAsync(
                caller.UserId, assignment.ClassId, assignment.SubjectId, cancellationToken))
        {
            return Result<Domain.Entities.Assignment>.Failure(NotAssigned, ErrorType.Forbidden);
        }

        return Result<Domain.Entities.Assignment>.Success(assignment);
    }

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

    private static Result<T> Fail<T>(string error, ErrorType errorType) =>
        Result<T>.Failure(error, errorType);

    // For rows read through a repository, which eager-loads Assignment and Student.
    private static SubmissionResponse ToResponse(SubmissionEntity s) =>
        ToResponse(s, s.Assignment.Title, s.Assignment.MaxMarks, s.Student.FullName);

    // For the teacher's list, where the parent assignment was fetched once for the whole page.
    private static SubmissionResponse ToResponse(SubmissionEntity s, string assignmentTitle, int maxMarks) =>
        ToResponse(s, assignmentTitle, maxMarks, s.Student.FullName);

    private static SubmissionResponse ToResponse(
        SubmissionEntity s,
        string assignmentTitle,
        int maxMarks,
        string studentName) =>
        new(
            s.Id,
            s.AssignmentId,
            assignmentTitle,
            maxMarks,
            s.StudentId,
            studentName,
            s.AnswerText,
            s.Status.ToString(),
            s.Marks,
            s.Feedback,
            s.IsLate,
            s.SubmittedAt,
            s.UpdatedAt,
            s.GradedAt);
}
