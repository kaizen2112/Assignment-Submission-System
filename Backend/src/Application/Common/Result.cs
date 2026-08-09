namespace AssignmentSystem.Application.Common;

// Why an explicit enum instead of matching substrings in the message (as docs/04 sketches):
// mapping "not found" -> 404 by string search breaks silently the moment someone rewords a
// message, and it cannot distinguish "the class was not found" from "no submissions found, which
// is fine". The failure's *kind* is a decision the service already made — record it.
public enum ErrorType
{
    None,
    Validation,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict
}

// Shared shape so one ToProblemResult extension handles both Result and Result<T>.
public interface IResultStatus
{
    bool IsSuccess { get; }
    string? Error { get; }
    ErrorType ErrorType { get; }
}

public sealed class Result : IResultStatus
{
    private Result(bool isSuccess, string? error, ErrorType errorType)
    {
        IsSuccess = isSuccess;
        Error = error;
        ErrorType = errorType;
    }

    public bool IsSuccess { get; }
    public string? Error { get; }
    public ErrorType ErrorType { get; }

    public static Result Success() => new(true, null, ErrorType.None);

    public static Result Failure(string error, ErrorType errorType = ErrorType.Validation) =>
        new(false, error, errorType);
}

public sealed class Result<T> : IResultStatus
{
    private readonly T? _value;

    private Result(bool isSuccess, T? value, string? error, ErrorType errorType)
    {
        IsSuccess = isSuccess;
        _value = value;
        Error = error;
        ErrorType = errorType;
    }

    public bool IsSuccess { get; }
    public string? Error { get; }
    public ErrorType ErrorType { get; }

    // Throws rather than returning default: reading Value off a failed Result is a programming
    // error, and a silent null would surface much further from the cause.
    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException($"Cannot read Value of a failed Result: {Error}");

    public static Result<T> Success(T value) => new(true, value, null, ErrorType.None);

    public static Result<T> Failure(string error, ErrorType errorType = ErrorType.Validation) =>
        new(false, default, error, errorType);
}
