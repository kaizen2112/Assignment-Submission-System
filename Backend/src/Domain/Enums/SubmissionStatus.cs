namespace AssignmentSystem.Domain.Enums;

// State machine (rule 8). SubmissionService validates every transition; anything not
// listed here is rejected as a Result failure rather than silently applied:
//
//   NotSubmitted → Submitted   student submits before the deadline
//   NotSubmitted → Late        student submits after it, only if AllowLateSubmission
//   Submitted    → Submitted   student edits before the deadline (status unchanged)
//   Submitted    → Graded      teacher grades
//   Late         → Graded      teacher grades a late submission
//
// NotSubmitted exists so the API can describe an assignment a student has not answered
// yet without inventing a row for it.
public enum SubmissionStatus
{
    NotSubmitted,
    Submitted,
    Late,
    Graded
}
