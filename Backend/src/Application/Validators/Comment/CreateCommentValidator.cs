using AssignmentSystem.Application.DTOs.Comment;
using FluentValidation;

namespace AssignmentSystem.Application.Validators.Comment;

public sealed class CreateCommentValidator : AbstractValidator<CreateCommentRequest>
{
    // Matches the varchar(1000) on comments.Content.
    internal const int ContentMaxLength = 1000;

    public CreateCommentValidator()
    {
        // NotEmpty rejects whitespace-only as well as empty, the same reasoning as SubmitAnswerValidator:
        // a comment of three spaces is not a contribution, and without this it would take up a row in
        // the thread and a slot in the upvote list.
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Content is required.")
            .MaximumLength(ContentMaxLength)
            .WithMessage($"Content cannot exceed {ContentMaxLength} characters.");
    }
}
