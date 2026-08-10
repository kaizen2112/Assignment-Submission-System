namespace AssignmentSystem.Application.Common;

// The wire shape for every list endpoint (docs/04). Page metadata travels in the body rather than
// in headers so the frontend can render "page 2 of 3" from one parsed response.
public sealed class PagedResult<T>
{
    public PagedResult(IReadOnlyList<T> items, int page, int pageSize, int totalCount)
    {
        Items = items;
        Page = page;
        PageSize = pageSize;
        TotalCount = totalCount;
    }

    public IReadOnlyList<T> Items { get; }
    public int Page { get; }
    public int PageSize { get; }
    public int TotalCount { get; }

    // Computed, not stored, so it can never disagree with TotalCount and PageSize.
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);

    // An empty page is a successful result, not an error — a student with no assignments yet gets
    // items: [] and totalCount: 0, never a 404.
    public static PagedResult<T> Empty(int page, int pageSize) => new([], page, pageSize, 0);
}
