using AssignmentSystem.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Persistence;

internal static class QueryableExtensions
{
    // One place for count-then-page, so no repository can get the arithmetic subtly wrong. Two
    // round trips is the correct trade here: a windowed COUNT(*) OVER() would fetch the total on
    // every row of the page.
    //
    // The caller is expected to have ordered the query already. An unordered Skip/Take has no
    // defined row order in PostgreSQL, so pages could overlap or drop rows between requests.
    internal static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> query,
        PaginationQuery pagination,
        CancellationToken cancellationToken)
    {
        var totalCount = await query.CountAsync(cancellationToken);

        // Short-circuit: with nothing to fetch, the second query is pure latency.
        if (totalCount == 0)
        {
            return PagedResult<T>.Empty(pagination.Page, pagination.PageSize);
        }

        var items = await query
            .Skip(pagination.Skip)
            .Take(pagination.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<T>(items, pagination.Page, pagination.PageSize, totalCount);
    }
}
