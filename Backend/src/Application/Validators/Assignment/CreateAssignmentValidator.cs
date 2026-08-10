using AssignmentSystem.Application.DTOs.Assignment;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Assignment;

public sealed class CreateAssignmentValidator : AbstractValidator<CreateAssignmentRequest>
{
    // Kept identical to the column widths in docs/02. A 201-character title should come back as a
    // 400 naming the field, not as a Postgres "value too long for type character varying(200)".
    internal const int TitleMaxLength = 200;
    internal const int DescriptionMaxLength = 5000;

    // docs/04's own error example says "Must be between 1 and 1000".
    internal const int MinMarks = 1;
    internal const int MaxMarksLimit = 1000;

    public CreateAssignmentValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(TitleMaxLength)
            .WithMessage($"Title cannot exceed {TitleMaxLength} characters.");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required.")
            .MaximumLength(DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {DescriptionMaxLength} characters.");

        // Validated through DeadlineUtc so a value sent as +06:00 is judged on the same clock as one
        // sent as Z. Rule 1 makes a past deadline meaningless at creation time — nobody could submit.
        // The error is reported against "Deadline", the field the client actually sent.
        RuleFor(x => x.DeadlineUtc)
            .GreaterThan(_ => DateTime.UtcNow)
            .WithMessage("Deadline must be in the future.")
            .OverridePropertyName(nameof(CreateAssignmentRequest.Deadline));

        RuleFor(x => x.MaxMarks)
            .InclusiveBetween(MinMarks, MaxMarksLimit)
            .WithMessage($"MaxMarks must be between {MinMarks} and {MaxMarksLimit}.");

        // Guid.Empty is what an omitted id binds to, and it would otherwise reach the database as a
        // lookup that simply finds nothing.
        RuleFor(x => x.ClassId)
            .NotEmpty().WithMessage("ClassId is required.");

        RuleFor(x => x.SubjectId)
            .NotEmpty().WithMessage("SubjectId is required.");
    }
}
