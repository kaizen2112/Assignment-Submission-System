using AssignmentSystem.Application.DTOs.Submission;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Submission;

public sealed class GradeSubmissionValidator : AbstractValidator<GradeSubmissionRequest>
{
    // Matches the varchar(2000) on submissions.Feedback in docs/02.
    internal const int FeedbackMaxLength = 2000;

    public GradeSubmissionValidator()
    {
        // Only the lower bound of rule 5 can be checked here. The upper bound is the parent
        // assignment's MaxMarks, which a validator cannot see, so SubmissionService owns it —
        // docs/05 calls this out explicitly and names the validator as the fast-fail half.
        RuleFor(x => x.Marks)
            .GreaterThanOrEqualTo(0).WithMessage("Marks cannot be negative.");

        RuleFor(x => x.Feedback)
            .MaximumLength(FeedbackMaxLength)
            .WithMessage($"Feedback cannot exceed {FeedbackMaxLength} characters.")
            .When(x => x.Feedback is not null);
    }
}
