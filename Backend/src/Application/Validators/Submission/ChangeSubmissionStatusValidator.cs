using AssignmentSystem.Application.DTOs.Submission;
using AssignmentSystem.Domain.Enums;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Submission;

public sealed class ChangeSubmissionStatusValidator : AbstractValidator<ChangeSubmissionStatusRequest>
{
    public ChangeSubmissionStatusValidator()
    {
        // Only checks that the value names a real status. Whether *this* status is reachable from
        // the submission's current one is rule 8, which needs the stored row — SubmissionService's
        // transition table decides that.
        RuleFor(x => x.Status)
            .NotEmpty().WithMessage("Status is required.")
            .Must(value => Enum.TryParse<SubmissionStatus>(value, ignoreCase: false, out _))
            .WithMessage(
                "Status must be one of: " +
                string.Join(", ", Enum.GetNames<SubmissionStatus>()) + ".")
            .When(x => !string.IsNullOrEmpty(x.Status));
    }
}
