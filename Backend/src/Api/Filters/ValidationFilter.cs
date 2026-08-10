using AssignmentSystem.Api.Extensions;
using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AssignmentSystem.Api.Filters;

// Runs FluentValidation for every action argument that has a registered validator, before the action
// body executes. This replaces the FluentValidation.AspNetCore auto-validation package, which its
// own maintainers deprecated in v11 and dropped in v12.
//
// Registered globally rather than per-action: a new endpoint is then validated the moment its
// validator exists, instead of the day someone remembers the attribute.
public sealed class ValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider _services;

    public ValidationFilter(IServiceProvider services) => _services = services;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var errors = new Dictionary<string, List<string>>();

        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null)
            {
                continue;
            }

            // Resolved by the argument's runtime type, so one filter covers every DTO in the API
            // without a registry to keep in sync.
            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (_services.GetService(validatorType) is not IValidator validator)
            {
                continue;
            }

            var result = await validator.ValidateAsync(
                new ValidationContext<object>(argument),
                context.HttpContext.RequestAborted);

            if (result.IsValid)
            {
                continue;
            }

            // Grouped by field: one property can fail several rules, and a client fixing a form
            // wants all of them at once rather than one per round trip.
            foreach (var failure in result.Errors)
            {
                if (!errors.TryGetValue(failure.PropertyName, out var messages))
                {
                    messages = [];
                    errors[failure.PropertyName] = messages;
                }

                messages.Add(failure.ErrorMessage);
            }
        }

        if (errors.Count > 0)
        {
            // Short-circuits: next() is never called, so the action never sees invalid input.
            context.Result = ValidationProblems.Create(
                errors.ToDictionary(pair => Camel(pair.Key), pair => pair.Value.ToArray()));
            return;
        }

        await next();
    }

    private static string Camel(string name) =>
        name.Length == 0 || char.IsLower(name[0]) ? name : char.ToLowerInvariant(name[0]) + name[1..];
}
