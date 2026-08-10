using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Common;

// The optional narrowing filters from GET /assignments (docs/04). All nullable — null means
// "don't filter on this", which is why they are not defaulted to a sentinel value.
//
// Note this filter can only ever *narrow* a result set. The role scoping of rules 3, 4 and 6 is
// applied by the repository method itself, so no value passed in here can widen what a caller sees.
public sealed record AssignmentFilter(
    Guid? ClassId = null,
    Guid? SubjectId = null,
    AssignmentStatus? Status = null)
{
    public static readonly AssignmentFilter None = new();
}
