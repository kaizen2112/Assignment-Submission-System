using AssignmentSystem.Application.DTOs.Submission;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Submission;

public sealed class SubmitAnswerValidator : AbstractValidator<SubmitAnswerRequest>
{
    // Matches the varchar(5000) on submissions.AnswerText in docs/02.
    internal const int AnswerMaxLength = 5000;

    public SubmitAnswerValidator()
    {
        // Whitespace-only is rejected as well as empty: a submission of three spaces is not an
        // attempt at the work, and it would otherwise satisfy rule 1 and count as submitted on time.
        RuleFor(x => x.AnswerText)
            .NotEmpty().WithMessage("AnswerText is required.")
            .MaximumLength(AnswerMaxLength)
            .WithMessage($"AnswerText cannot exceed {AnswerMaxLength} characters.");
    }
}
