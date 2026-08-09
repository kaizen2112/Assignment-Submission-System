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

    public Guid AssignmentId { get; private set; }
    public Assignment Assignment { get; private set; } = null!;

    public Guid StudentId { get; private set; }
    public User Student { get; private set; } = null!;

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
