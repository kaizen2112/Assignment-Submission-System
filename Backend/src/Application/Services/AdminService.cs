using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Admin;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Services;

public sealed class AdminService : IAdminService
{
    private readonly IUserRepository _users;
    private readonly IClassRepository _classes;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ICurrentUserService _currentUser;

    public AdminService(
        IUserRepository users,
        IClassRepository classes,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUser)
    {
        _users = users;
        _classes = classes;
        _passwordHasher = passwordHasher;
        _currentUser = currentUser;
    }

    // --- Users ------------------------------------------------------------------------------------

    public async Task<Result<PagedResult<UserResponse>>> GetUsersAsync(
        UserQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        var pagination = query.ToPagination();

        var check = pagination.Validate();
        if (!check.IsSuccess)
        {
            return Result<PagedResult<UserResponse>>.Failure(check.Error!, check.ErrorType);
        }

        var page = await _users.GetPagedAsync(pagination, query.Role, query.Search, cancellationToken);

        return Result<PagedResult<UserResponse>>.Success(page.Map(ToResponse));
    }

    public async Task<Result<UserResponse>> CreateUserAsync(
        CreateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        // The validator already confirmed the string names a real role, so this cannot fail in
        // practice — but the service must not depend on having been called through the filter.
        if (!Enum.TryParse<Role>(request.Role, ignoreCase: false, out var role))
        {
            return Result<UserResponse>.Failure($"'{request.Role}' is not a valid role.", ErrorType.Validation);
        }

        var email = request.Email.Trim();

        // Asked rather than caught: the unique index on users.Email would otherwise surface as a
        // DbUpdateException, and that type is not visible from this layer.
        if (await _users.EmailExistsAsync(email, cancellationToken: cancellationToken))
        {
            return Result<UserResponse>.Failure(
                "A user with this email already exists.", ErrorType.Conflict);
        }

        var user = User.Create(
            request.FullName.Trim(), email, _passwordHasher.Hash(request.Password), role);

        await _users.AddAsync(user, cancellationToken);
        await _users.SaveChangesAsync(cancellationToken);

        return Result<UserResponse>.Success(ToResponse(user));
    }

    public async Task<Result<UserResponse>> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<Role>(request.Role, ignoreCase: false, out var role))
        {
            return Result<UserResponse>.Failure($"'{request.Role}' is not a valid role.", ErrorType.Validation);
        }

        var user = await _users.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<UserResponse>.Failure("User not found.", ErrorType.NotFound);
        }

        var email = request.Email.Trim();

        // excludeUserId is what lets someone rename themselves without their own email reading as a
        // duplicate — without it, editing only a full name would fail.
        if (await _users.EmailExistsAsync(email, id, cancellationToken))
        {
            return Result<UserResponse>.Failure(
                "Another user already has this email.", ErrorType.Conflict);
        }

        // A teacher who authored assignments cannot become a Student, and a student who submitted
        // work cannot become a Teacher: their existing rows would describe someone whose role makes
        // those rows impossible. Only blocked when the role actually changes, so ordinary profile
        // edits stay available.
        if (user.Role != role && await _users.HasAcademicRecordsAsync(id, cancellationToken))
        {
            return Result<UserResponse>.Failure(
                $"This user has assignments or submissions on record, so their role cannot be " +
                $"changed from {user.Role} to {role}.",
                ErrorType.Conflict);
        }

        user.Update(request.FullName.Trim(), email, role);

        if (request.NewPassword is not null)
        {
            user.SetPasswordHash(_passwordHasher.Hash(request.NewPassword));
        }

        await _users.SaveChangesAsync(cancellationToken);

        return Result<UserResponse>.Success(ToResponse(user));
    }

    public async Task<Result> DeleteUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _users.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result.Failure("User not found.", ErrorType.NotFound);
        }

        // An admin deleting their own account would invalidate the token they are holding and, if
        // they are the only admin, lock everyone out of administration permanently.
        if (_currentUser.UserId == id)
        {
            return Result.Failure("You cannot delete your own account.", ErrorType.Conflict);
        }

        // assignments.CreatedByTeacherId and submissions.StudentId are ON DELETE RESTRICT, so the
        // database would refuse this anyway. Asking first turns a 500 into a 409 that explains itself.
        if (await _users.HasAcademicRecordsAsync(id, cancellationToken))
        {
            return Result.Failure(
                "This user has assignments or submissions on record and cannot be deleted.",
                ErrorType.Conflict);
        }

        _users.Remove(user);
        await _users.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    // --- Classes and subjects ---------------------------------------------------------------------

    public async Task<Result<PagedResult<ClassResponse>>> GetClassesAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        var pagination = query.ToPagination();

        var check = pagination.Validate();
        if (!check.IsSuccess)
        {
            return Result<PagedResult<ClassResponse>>.Failure(check.Error!, check.ErrorType);
        }

        var page = await _classes.GetPagedAsync(pagination, cancellationToken);

        return Result<PagedResult<ClassResponse>>.Success(page.Map(ToResponse));
    }

    public async Task<Result<ClassResponse>> CreateClassAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken = default)
    {
        var code = request.Code.Trim();

        // Case-insensitive, so "10a" cannot join "10A" as a second class nobody can tell apart.
        if (await _classes.CodeExistsAsync(code, cancellationToken))
        {
            return Result<ClassResponse>.Failure(
                $"A class with code '{code}' already exists.", ErrorType.Conflict);
        }

        var @class = Class.Create(request.Name.Trim(), code);

        await _classes.AddAsync(@class, cancellationToken);
        await _classes.SaveChangesAsync(cancellationToken);

        return Result<ClassResponse>.Success(ToResponse(@class));
    }

    public async Task<Result<SubjectResponse>> AddSubjectAsync(
        Guid classId,
        CreateSubjectRequest request,
        CancellationToken cancellationToken = default)
    {
        var @class = await _classes.GetByIdAsync(classId, cancellationToken);
        if (@class is null)
        {
            return Result<SubjectResponse>.Failure("Class not found.", ErrorType.NotFound);
        }

        var name = request.Name.Trim();

        // Scoped to the class, matching the unique index on (ClassId, Name): "Mathematics" in 10A and
        // in 10B are two legitimate rows.
        if (await _classes.SubjectExistsInClassAsync(classId, name, cancellationToken))
        {
            return Result<SubjectResponse>.Failure(
                $"'{name}' is already a subject in this class.", ErrorType.Conflict);
        }

        var subject = Subject.Create(name, classId);

        await _classes.AddSubjectAsync(subject, cancellationToken);
        await _classes.SaveChangesAsync(cancellationToken);

        return Result<SubjectResponse>.Success(new SubjectResponse(subject.Id, subject.Name, subject.ClassId));
    }

    // --- Teacher assignments and enrollments ------------------------------------------------------

    public async Task<Result<TeacherAssignmentResponse>> AssignTeacherAsync(
        CreateTeacherAssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        var teacher = await _users.GetByIdAsync(request.TeacherId, cancellationToken);
        if (teacher is null)
        {
            return Result<TeacherAssignmentResponse>.Failure("Teacher not found.", ErrorType.NotFound);
        }

        // Every rule-4 check downstream assumes a TeacherAssignment row belongs to an actual teacher.
        // Letting a student be assigned here would quietly grant them a teacher's authority.
        if (teacher.Role != Role.Teacher)
        {
            return Result<TeacherAssignmentResponse>.Failure(
                $"{teacher.FullName} is a {teacher.Role}, not a Teacher.", ErrorType.Validation);
        }

        var subject = await _classes.GetSubjectByIdAsync(request.SubjectId, cancellationToken);
        if (subject is null)
        {
            return Result<TeacherAssignmentResponse>.Failure("Subject not found.", ErrorType.NotFound);
        }

        // TeacherAssignment stores ClassId as well as SubjectId so rule 4 resolves in one lookup.
        // That denormalization is only safe while the two agree, which is what this enforces.
        if (subject.ClassId != request.ClassId)
        {
            return Result<TeacherAssignmentResponse>.Failure(
                "The subject does not belong to the specified class.", ErrorType.Validation);
        }

        var @class = await _classes.GetByIdAsync(request.ClassId, cancellationToken);
        if (@class is null)
        {
            return Result<TeacherAssignmentResponse>.Failure("Class not found.", ErrorType.NotFound);
        }

        if (await _classes.TeacherAssignmentExistsAsync(
                request.TeacherId, request.ClassId, request.SubjectId, cancellationToken))
        {
            return Result<TeacherAssignmentResponse>.Failure(
                $"{teacher.FullName} is already assigned to {subject.Name} in {@class.Code}.",
                ErrorType.Conflict);
        }

        var assignment = TeacherAssignment.Create(request.TeacherId, request.SubjectId, request.ClassId);

        await _classes.AddTeacherAssignmentAsync(assignment, cancellationToken);
        await _classes.SaveChangesAsync(cancellationToken);

        return Result<TeacherAssignmentResponse>.Success(new TeacherAssignmentResponse(
            assignment.Id,
            teacher.Id,
            teacher.FullName,
            subject.Id,
            subject.Name,
            @class.Id,
            @class.Name,
            assignment.AssignedAt));
    }

    public async Task<Result<EnrollmentResponse>> EnrollStudentAsync(
        CreateEnrollmentRequest request,
        CancellationToken cancellationToken = default)
    {
        var student = await _users.GetByIdAsync(request.StudentId, cancellationToken);
        if (student is null)
        {
            return Result<EnrollmentResponse>.Failure("Student not found.", ErrorType.NotFound);
        }

        // Enrollment is what rule 3 scopes a student by. Enrolling a teacher would put them in the
        // student visibility set without giving them anything useful.
        if (student.Role != Role.Student)
        {
            return Result<EnrollmentResponse>.Failure(
                $"{student.FullName} is a {student.Role}, not a Student.", ErrorType.Validation);
        }

        var @class = await _classes.GetByIdAsync(request.ClassId, cancellationToken);
        if (@class is null)
        {
            return Result<EnrollmentResponse>.Failure("Class not found.", ErrorType.NotFound);
        }

        // A duplicate enrollment would not break the assignment query — it uses a subquery precisely
        // so a doubled row cannot duplicate results — but it is still a data error worth refusing.
        if (await _classes.EnrollmentExistsAsync(request.StudentId, request.ClassId, cancellationToken))
        {
            return Result<EnrollmentResponse>.Failure(
                $"{student.FullName} is already enrolled in {@class.Code}.", ErrorType.Conflict);
        }

        var enrollment = StudentEnrollment.Create(request.StudentId, request.ClassId);

        await _classes.AddEnrollmentAsync(enrollment, cancellationToken);
        await _classes.SaveChangesAsync(cancellationToken);

        return Result<EnrollmentResponse>.Success(new EnrollmentResponse(
            enrollment.Id,
            student.Id,
            student.FullName,
            @class.Id,
            @class.Name,
            enrollment.EnrolledAt));
    }

    // --- Mapping ----------------------------------------------------------------------------------

    private static UserResponse ToResponse(User user) =>
        new(user.Id, user.FullName, user.Email, user.Role.ToString(), user.CreatedAt);

    private static ClassResponse ToResponse(Class @class) =>
        new(
            @class.Id,
            @class.Name,
            @class.Code,
            @class.CreatedAt,
            [.. @class.Subjects.Select(s => new SubjectResponse(s.Id, s.Name, s.ClassId))]);
}
