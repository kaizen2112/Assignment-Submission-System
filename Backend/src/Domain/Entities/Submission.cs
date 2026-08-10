using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

public sealed class Submission
{
    private Submission() { }

    public Guid Id { get; private set; }

    // Text-only submissions — no file uploads. Logged as an assumption in the README.
    public string AnswerText { get; private set; } = null!;

    public SubmissionStatus Status { get; private set; }

    // Null until graded. Nullable rather than 0-means-ungraded, because 0 is a legitimate mark.
    public int? Marks { get; private set; }
    public string? Feedback { get; private set; }

    // Kept separately from Status because Status advances to Graded and would otherwise erase
    // the fact that the work arrived late — which a teacher still needs to see afterwards.
    public bool IsLate { get; private set; }

    // `internal set` on the navigations for the same reason as Assignment.Class: EF fills them, no
    // application code may, and the tests must be able to assemble the graph a repository would
    // return. Rules 2 and 5 both read through Assignment, so a test without it proves nothing.
    public Guid AssignmentId { get; private set; }
    public Assignment Assignment { get; internal set; } = null!;

    public Guid StudentId { get; private set; }
    public User Student { get; internal set; } = null!;

    public DateTime SubmittedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? GradedAt { get; private set; }

    // The caller decides lateness, because that needs the assignment's deadline and its
    // AllowLateSubmission flag — both outside this aggregate. Status is then derived rather
    // than passed in, so a late submission can never be recorded as an on-time one.
    public static Submission Create(Guid assignmentId, Guid studentId, string answerText, bool isLate)
    {
        return new Submission
        {
            Id = Guid.NewGuid(),
            AssignmentId = assignmentId,
            StudentId = studentId,
            AnswerText = answerText,
            IsLate = isLate,
            Status = isLate ? SubmissionStatus.Late : SubmissionStatus.Submitted,
            SubmittedAt = DateTime.UtcNow
        };
    }

    // Status is deliberately untouched: rule 8 allows Submitted -> Submitted for an edit, and a
    // submission that arrived Late stays Late no matter how often it is revised. Whether the edit is
    // permitted at all (deadline, grading lock) is rule 2, checked by SubmissionService above this.
    public void Update(string answerText)
    {
        AnswerText = answerText;
        UpdatedAt = DateTime.UtcNow;
    }

    // The teacher-driven status move of rule 8. Whether the transition is legal is decided by the
    // service's transition table — this method only applies it, the same division of labour Grade
    // uses for the rule-5 bounds check.
    public void ChangeStatus(SubmissionStatus status)
    {
        Status = status;

        // Keeps GradedAt consistent with Status when a teacher moves a submission to Graded through
        // the status endpoint rather than by recording marks.
        if (status == SubmissionStatus.Graded)
        {
            GradedAt ??= DateTime.UtcNow;
        }
    }

    // Terminal state in the rule-8 machine, and the point at which the student loses edit rights
    // (documented assumption: grading locks the submission). The marks-vs-MaxMarks check of
    // rule 5 lives in SubmissionService — this aggregate cannot see the parent assignment's
    // limit, so validating here would mean guessing.
    public void Grade(int marks, string? feedback)
    {
        Marks = marks;
        Feedback = feedback;
        Status = SubmissionStatus.Graded;
        GradedAt = DateTime.UtcNow;
    }
}
