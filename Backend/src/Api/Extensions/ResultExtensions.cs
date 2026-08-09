using AssignmentSystem.Application.Common;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Extensions;

public static class ResultExtensions
{
    // Single place where a service failure becomes an HTTP status, so no controller has to decide
    // it — and none can decide it differently. Every failure leaves as RFC 7807 Problem Details.
    public static IActionResult ToProblemResult(this IResultStatus result)
    {
        if (result.IsSuccess)
        {
            throw new InvalidOperationException("ToProblemResult called on a successful Result.");
        }

        var (status, title) = result.ErrorType switch
        {
            ErrorType.Unauthorized => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            ErrorType.Forbidden => (StatusCodes.Status403Forbidden, "Forbidden"),
            ErrorType.NotFound => (StatusCodes.Status404NotFound, "Not found"),
            ErrorType.Conflict => (StatusCodes.Status409Conflict, "Conflict"),
            _ => (StatusCodes.Status400BadRequest, "Validation failed")
        };

        return new ObjectResult(new ProblemDetails
        {
            Type = "https://tools.ietf.org/html/rfc7807",
            Title = title,
            Status = status,
            Detail = result.Error
        })
        {
            StatusCode = status,
            ContentTypes = { "application/problem+json" }
        };
    }
}
