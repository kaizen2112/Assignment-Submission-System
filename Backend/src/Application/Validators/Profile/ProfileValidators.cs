using AssignmentSystem.Application.DTOs.Profile;
using AssignmentSystem.Application.Validators.Admin;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Profile;

// Reuses UserRules from the admin validators rather than restating the limits. A password an admin may set
// but a user may not choose for themselves — or the reverse — would be a genuinely baffling bug, and two
// copies of "at least 8 characters, one letter, one digit" is how that happens.
public sealed class UpdateProfileValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileValidator()
    {
        UserRules.FullName(RuleFor(r => r.FullName));
    }
}

public sealed class ChangePasswordValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordValidator()
    {
        // NotEmpty only. The current password is checked against the stored hash, so applying the strength
        // rules to it would reject a legitimate attempt by anyone whose existing password predates them —
        // and would leak the fact that it does.
        RuleFor(r => r.CurrentPassword)
            .NotEmpty().WithMessage("Your current password is required.");

        UserRules.Password(RuleFor(r => r.NewPassword));
    }
}
