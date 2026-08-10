namespace AssignmentSystem.Application.Common;

// The request half of the pagination contract in docs/04: ?page=1&pageSize=20&sortBy=x&sortDir=desc
// Controllers bind this straight from the query string, so the defaults here are the API's defaults.
public sealed record PaginationQuery
{
    public const int DefaultPageSize = 20;

    // A cap, not a suggestion: without it one request can ask for every row in the table.
    public const int MaxPageSize = 100;

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = DefaultPageSize;

    // Interpreted by each repository against its own allow-list of sortable columns. Unknown or
    // absent values fall back to that repository's default ordering rather than failing.
    public string? SortBy { get; init; }

    public string? SortDir { get; init; }

    // Descending by default: the newest row is what a list screen almost always wants first.
    public bool SortDescending => !string.Equals(SortDir, "asc", StringComparison.OrdinalIgnoreCase);

    public int Skip => (Page - 1) * PageSize;

    // docs/04 says reject an oversized pageSize rather than silently clamping it — a caller asking
    // for 1000 rows and receiving 100 without being told has no way to notice the truncation.
    public Result Validate()
    {
        if (Page < 1)
        {
            return Result.Failure("page must be 1 or greater.");
        }

        if (PageSize < 1)
        {
            return Result.Failure("pageSize must be 1 or greater.");
        }

        return PageSize > MaxPageSize
            ? Result.Failure($"pageSize cannot exceed {MaxPageSize}.")
            : Result.Success();
    }
}
