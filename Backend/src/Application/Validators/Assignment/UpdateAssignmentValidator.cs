using AssignmentSystem.Application.DTOs.Assignment;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Assignment;

public sealed class UpdateAssignmentValidator : AbstractValidator<UpdateAssignmentRequest>
{
    public UpdateAssignmentValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(CreateAssignmentValidator.TitleMaxLength)
            .WithMessage($"Title cannot exceed {CreateAssignmentValidator.TitleMaxLength} characters.");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required.")
            .MaximumLength(CreateAssignmentValidator.DescriptionMaxLength)
            .WithMessage(
                $"Description cannot exceed {CreateAssignmentValidator.DescriptionMaxLength} characters.");

        RuleFor(x => x.MaxMarks)
            .InclusiveBetween(CreateAssignmentValidator.MinMarks, CreateAssignmentValidator.MaxMarksLimit)
            .WithMessage(
                $"MaxMarks must be between {CreateAssignmentValidator.MinMarks} and " +
                $"{CreateAssignmentValidator.MaxMarksLimit}.");

        // Deliberately no "must be in the future" rule here, unlike the create validator. It would
        // make an overdue assignment permanently uneditable — a teacher could not fix a typo in the
        // title of last week's homework. AssignmentService applies the check only when the deadline
        // actually changes, which it can see and a validator cannot.
    }
}
