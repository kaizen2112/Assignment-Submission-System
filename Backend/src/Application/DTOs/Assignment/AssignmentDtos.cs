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
    // The name as well as the id. A student sees who set the work, and resolving an id to a name would
    // otherwise mean a second request per assignment to an endpoint students cannot call anyway — only
    // an admin may list users.
    string CreatedByTeacherName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    // How much of the class has handed in. **Null for a student caller**, and null server-side rather than
    // merely hidden by the UI: the count of who else has submitted is information about a student's
    // classmates, and sending it down to be hidden puts it one network-tab click away. Same reasoning as
    // the blanked fields on a deleted comment.
    CompletionStats? Completion = null);

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
    // Present on the list item too, not just the detail response. The student's assignment cards show who
    // set each one, and a card that had to fetch the detail response to fill in a name would turn one
    // request into N — the same reason Description is left out above.
    Guid CreatedByTeacherId,
    string CreatedByTeacherName,
    DateTime CreatedAt,
    // As above: populated for a teacher or an admin, null for a student.
    CompletionStats? Completion = null);

// What a teacher is allowed to create an assignment for: one row per class+subject pair they hold.
// Flat rather than nested (a class with its subjects inside) because the create form needs to pick a
// *pair* — a teacher may hold Mathematics in 10A without holding Physics in 10A, so offering the
// class's full subject list would offer combinations rule 4 then rejects with a 403.
public sealed record TeachingScopeResponse(
    Guid ClassId,
    string ClassName,
    string ClassCode,
    Guid SubjectId,
    string SubjectName);

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
