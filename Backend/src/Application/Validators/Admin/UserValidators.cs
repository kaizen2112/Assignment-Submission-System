using AssignmentSystem.Application.DTOs.Admin;
using AssignmentSystem.Domain.Enums;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Admin;

// Shared by create and update so the two cannot drift — an email valid on create but rejected on
// update would be a maddening bug to diagnose.
internal static class UserRules
{
    internal const int FullNameMaxLength = 200;
    internal const int EmailMaxLength = 256;
    internal const int PasswordMinLength = 8;

    // BCrypt silently truncates input beyond 72 bytes, so anything longer is security theatre: two
    // different 100-character passwords could share a hash.
    internal const int PasswordMaxLength = 72;

    internal static IRuleBuilderOptions<T, string> FullName<T>(IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("FullName is required.")
            .MaximumLength(FullNameMaxLength)
            .WithMessage($"FullName cannot exceed {FullNameMaxLength} characters.");

    internal static IRuleBuilderOptions<T, string> Email<T>(IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Email must be a valid email address.")
            .MaximumLength(EmailMaxLength)
            .WithMessage($"Email cannot exceed {EmailMaxLength} characters.");

    internal static IRuleBuilderOptions<T, string> Role<T>(IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Role is required.")
            .Must(value => Enum.TryParse<Role>(value, ignoreCase: false, out _))
            .WithMessage("Role must be one of: " + string.Join(", ", Enum.GetNames<Role>()) + ".");

    internal static IRuleBuilderOptions<T, string> Password<T>(IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Password is required.")
            .MinimumLength(PasswordMinLength)
            .WithMessage($"Password must be at least {PasswordMinLength} characters.")
            .MaximumLength(PasswordMaxLength)
            .WithMessage($"Password cannot exceed {PasswordMaxLength} characters.")
            // Deliberately mild: a length floor plus a letter and a digit. Demanding symbols and
            // mixed case pushes users toward one predictable pattern, and the demo accounts in the
            // README have to satisfy whatever this says.
            .Must(value => value.Any(char.IsLetter) && value.Any(char.IsDigit))
            .WithMessage("Password must contain at least one letter and one digit.");
}

public sealed class CreateUserValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        UserRules.FullName(RuleFor(x => x.FullName));
        UserRules.Email(RuleFor(x => x.Email));
        UserRules.Role(RuleFor(x => x.Role));
        UserRules.Password(RuleFor(x => x.Password));
    }
}

public sealed class UpdateUserValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserValidator()
    {
        UserRules.FullName(RuleFor(x => x.FullName));
        UserRules.Email(RuleFor(x => x.Email));
        UserRules.Role(RuleFor(x => x.Role));

        // Only validated when supplied: omitting it means "leave the password alone", so an absent
        // field must not read as an empty one.
        UserRules.Password(RuleFor(x => x.NewPassword!)).When(x => x.NewPassword is not null);
    }
}
