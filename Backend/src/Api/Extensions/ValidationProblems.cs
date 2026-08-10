using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace AssignmentSystem.Api.Extensions;

// Two different things produce a 400 with field-level errors: MVC's model binder (malformed JSON,
// a Guid that isn't a Guid) and FluentValidation. Both come through here so a client sees one shape
// regardless of which one rejected the request.
internal static class ValidationProblems
{
    internal static ObjectResult Create(IDictionary<string, string[]> errors) =>
        new(new ValidationProblemDetails(errors)
        {
            Type = "https://tools.ietf.org/html/rfc7807",
            Title = "Validation failed",
            Status = StatusCodes.Status400BadRequest
        })
        {
            StatusCode = StatusCodes.Status400BadRequest,
            ContentTypes = { "application/problem+json" }
        };

    internal static ObjectResult FromModelState(ModelStateDictionary modelState) =>
        Create(modelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .ToDictionary(
                entry => ToCamelCase(entry.Key),
                entry => entry.Value!.Errors.Select(ToMessage).ToArray()));

    // The binder's raw exception text ("Could not convert string to Guid: abc. Path: $.classId")
    // names internal paths and types. Replaced with the field name the client actually sent.
    private static string ToMessage(ModelError error) =>
        string.IsNullOrWhiteSpace(error.ErrorMessage)
            ? "The value provided is not valid for this field."
            : error.ErrorMessage;

    // Keys arrive as "MaxMarks" from validators and "$.maxMarks" from the JSON binder. Normalizing
    // both to camelCase keeps the errors object consistent with every other field name in the API.
    private static string ToCamelCase(string key)
    {
        // A bare "$" is the JSON document root, which the binder reports when the payload failed to
        // parse at all. "body" says the same thing without exposing JSONPath syntax.
        if (key == "$")
        {
            return "body";
        }

        var name = key.StartsWith("$.", StringComparison.Ordinal) ? key[2..] : key;

        if (name.Length == 0 || char.IsLower(name[0]))
        {
            return name;
        }

        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
