using AssignmentSystem.Application.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.DTOs.Common;

// The bindable face of PaginationQuery. MVC's complex-type model binder needs a parameterless
// constructor and settable properties, which PaginationQuery (an init-only record) does not offer —
// so query-string concerns live here and the domain-facing type stays immutable.
public class PagedQueryParameters
{
    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = PaginationQuery.DefaultPageSize;

    public string? SortBy { get; set; }

    public string? SortDir { get; set; }

    public PaginationQuery ToPagination() => new()
    {
        Page = Page,
        PageSize = PageSize,
        SortBy = SortBy,
        SortDir = SortDir
    };
}

// GET /api/v1/assignments?classId=&subjectId=&status=&page=&pageSize=&sortBy=&sortDir=
public sealed class AssignmentQueryParameters : PagedQueryParameters
{
    public Guid? ClassId { get; set; }

    public Guid? SubjectId { get; set; }

    // Bound as the enum so an unparseable value ("Publishd") is a 400 from the model binder rather
    // than a filter that silently matches nothing.
    public AssignmentStatus? Status { get; set; }

    public AssignmentFilter ToFilter() => new(ClassId, SubjectId, Status);
}
