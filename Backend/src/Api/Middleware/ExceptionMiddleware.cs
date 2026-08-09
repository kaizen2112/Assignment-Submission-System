using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Middleware;

// Last line of defence. Expected failures already travel as Result, so anything reaching here is a
// genuine bug — it must be logged in full server-side and described in the vaguest possible terms
// to the client.
public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionMiddleware(
        RequestDelegate next,
        ILogger<ExceptionMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client hung up. Not a fault, and there is nobody left to send a response to —
            // logging it as an error would fill the log with noise on every cancelled request.
            _logger.LogInformation("Request {Method} {Path} was cancelled by the client.",
                context.Request.Method, context.Request.Path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception for {Method} {Path}",
                context.Request.Method, context.Request.Path);

            // Headers already sent means a partially-written response — appending JSON would
            // corrupt it. Nothing to do but let the connection fail.
            if (context.Response.HasStarted)
            {
                throw;
            }

            var problem = new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc7807",
                Title = "An unexpected error occurred.",
                Status = StatusCodes.Status500InternalServerError,

                // Exception type and message in Development only, and never a stack trace or an
                // inner-exception chain. In Production the client learns nothing beyond "500" —
                // messages routinely leak table names, file paths and connection strings.
                Detail = _environment.IsDevelopment()
                    ? $"{ex.GetType().Name}: {ex.Message}"
                    : "An internal error occurred. Please contact support if it persists."
            };

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            await context.Response.WriteAsync(JsonSerializer.Serialize(problem, JsonOptions));
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
}
