namespace AssignmentSystem.Application.DTOs.Assignment;

// Request shapes mirror docs/04 exactly. Both carry a DeadlineUtc helper so the validator and the
// service normalize the incoming DateTime identically — two copies of that logic would eventually
// disagree about whether a deadline is in the future.
public sealed record CreateAssignmentRequest(
    string Title,
    string Description,
    DateTime Deadline,
    int MaxMarks,
    Guid ClassId,
    Guid SubjectId,
    bool AllowLateSubmission = false)
{
    public DateTime DeadlineUtc => Deadline.ToUtcAssumingUtc();
}

// No ClassId or SubjectId: an assignment cannot be moved between classes (see Assignment.Update).
public sealed record UpdateAssignmentRequest(
    string Title,
    string Description,
    DateTime Deadline,
    int MaxMarks,
    bool AllowLateSubmission = false)
{
    public DateTime DeadlineUtc => Deadline.ToUtcAssumingUtc();
}

// Status is a string, not the enum: the JSON contract should not shift if the enum's member order
// changes, and "Published" reads better than 1 in a response body.
public sealed record AssignmentResponse(
    Guid Id,
    string Title,
    string Description,
    DateTime Deadline,
    int MaxMarks,
    string Status,
    bool AllowLateSubmission,
    bool IsOverdue,
    Guid ClassId,
    string ClassName,
    Guid SubjectId,
    string SubjectName,
    Guid CreatedByTeacherId,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// Description is omitted deliberately: it holds up to 5000 characters, and a 100-item page would
// otherwise ship half a megabyte of text no list screen displays.
public sealed record AssignmentListItemResponse(
    Guid Id,
    string Title,
    DateTime Deadline,
    int MaxMarks,
    string Status,
    bool AllowLateSubmission,
    bool IsOverdue,
    Guid ClassId,
    string ClassName,
    Guid SubjectId,
    string SubjectName,
    DateTime CreatedAt);

internal static class DateTimeNormalization
{
    // Npgsql refuses to write a DateTime whose Kind is Unspecified to a timestamptz column, and
    // System.Text.Json produces exactly that when the client omits the offset ("2026-08-20T23:59:00"
    // with no trailing Z). Treating a bare timestamp as UTC is the documented assumption (README);
    // the alternative — rejecting it — turns a Swagger try-it-out into a 400 for no real gain.
    internal static DateTime ToUtcAssumingUtc(this DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        _ => value.ToUniversalTime()
    };
}
