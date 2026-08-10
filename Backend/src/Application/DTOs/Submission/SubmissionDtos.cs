namespace AssignmentSystem.Application.DTOs.Submission;

// Used by both POST (submit) and PUT (update own) — the payload is identical, and a second record
// with the same single field would only invite the two to drift apart.
public sealed record SubmitAnswerRequest(string AnswerText);

// Feedback is optional: a full-marks submission often needs no comment.
public sealed record GradeSubmissionRequest(int Marks, string? Feedback);

// Status arrives as a string ("Graded") to match docs/04. Deliberately not bound as the enum: that
// would need a global JsonStringEnumConverter, and an unrecognised value would surface as a binder
// error naming the .NET type instead of a 400 listing the statuses a teacher may actually set.
public sealed record ChangeSubmissionStatusRequest(string Status);

// MaxMarks rides along so a client can render "85 / 100" without a second request for the
// assignment. AnswerText is included even in list responses — docs/04 gives the teacher no
// per-submission GET, so the list is the only place they can read the work they are grading.
public sealed record SubmissionResponse(
    Guid Id,
    Guid AssignmentId,
    string AssignmentTitle,
    int MaxMarks,
    Guid StudentId,
    string StudentName,
    string AnswerText,
    string Status,
    int? Marks,
    string? Feedback,
    bool IsLate,
    DateTime SubmittedAt,
    DateTime? UpdatedAt,
    DateTime? GradedAt);
