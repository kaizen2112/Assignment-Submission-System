using AssignmentSystem.Application.DTOs.Admin;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Admin;

public sealed class CreateClassValidator : AbstractValidator<CreateClassRequest>
{
    // Matches the column widths in docs/02: classes.Name varchar(100), classes.Code varchar(20).
    internal const int NameMaxLength = 100;
    internal const int CodeMaxLength = 20;

    public CreateClassValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(NameMaxLength)
            .WithMessage($"Name cannot exceed {NameMaxLength} characters.");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Code is required.")
            .MaximumLength(CodeMaxLength)
            .WithMessage($"Code cannot exceed {CodeMaxLength} characters.")
            // A code is a handle people type and compare ("10A"). Allowing spaces or punctuation
            // invites "10 A" and "10-A" to coexist as different classes.
            .Matches("^[A-Za-z0-9-]+$")
            .WithMessage("Code may contain only letters, digits and hyphens.");
    }
}

public sealed class CreateSubjectValidator : AbstractValidator<CreateSubjectRequest>
{
    // subjects.Name varchar(100).
    internal const int NameMaxLength = 100;

    public CreateSubjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(NameMaxLength)
            .WithMessage($"Name cannot exceed {NameMaxLength} characters.");
    }
}

public sealed class CreateTeacherAssignmentValidator : AbstractValidator<CreateTeacherAssignmentRequest>
{
    public CreateTeacherAssignmentValidator()
    {
        // NotEmpty on a Guid rejects Guid.Empty, which is what an omitted field binds to.
        RuleFor(x => x.TeacherId).NotEmpty().WithMessage("TeacherId is required.");
        RuleFor(x => x.SubjectId).NotEmpty().WithMessage("SubjectId is required.");
        RuleFor(x => x.ClassId).NotEmpty().WithMessage("ClassId is required.");
    }
}

public sealed class CreateEnrollmentValidator : AbstractValidator<CreateEnrollmentRequest>
{
    public CreateEnrollmentValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty().WithMessage("StudentId is required.");
        RuleFor(x => x.ClassId).NotEmpty().WithMessage("ClassId is required.");
    }
}
