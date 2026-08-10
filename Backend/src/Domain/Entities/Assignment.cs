using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

public sealed class Assignment
{
    private readonly List<Submission> _submissions = [];

    private Assignment() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = null!;
    public string Description { get; private set; } = null!;
    public DateTime Deadline { get; private set; }
    public int MaxMarks { get; private set; }
    public AssignmentStatus Status { get; private set; }

    // Opt-in per assignment, default false. Deliberately not a global setting so one lenient
    // assignment cannot loosen the deadline rule for every other one (rule 1).
    public bool AllowLateSubmission { get; private set; }

    // Scope. Both IDs are needed to match against a TeacherAssignment row when authorizing
    // the creating teacher (rule 4).
    //
    // The two navigation properties are `internal set` rather than `private set`: EF populates them,
    // application code must never assign one, and the unit tests need to build the same graph EF
    // would. Internal keeps them unreachable from Application and Api, where the temptation would be
    // to attach an entity by hand instead of loading it.
    public Guid ClassId { get; private set; }
    public Class Class { get; internal set; } = null!;
    public Guid SubjectId { get; private set; }
    public Subject Subject { get; internal set; } = null!;

    public Guid CreatedByTeacherId { get; private set; }
    public User CreatedByTeacher { get; private set; } = null!;

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<Submission> Submissions => _submissions;

    // Status is not a parameter: nothing is born Published. Publishing is a deliberate,
    // separately-authorized transition, which keeps rule 6 impossible to bypass by passing a
    // status at construction time.
    public static Assignment Create(
        string title,
        string description,
        DateTime deadline,
        int maxMarks,
        Guid classId,
        Guid subjectId,
        Guid createdByTeacherId,
        bool allowLateSubmission = false)
    {
        var now = DateTime.UtcNow;

        return new Assignment
        {
            Id = Guid.NewGuid(),
            Title = title,
            Description = description,
            Deadline = deadline,
            MaxMarks = maxMarks,
            Status = AssignmentStatus.Draft,
            AllowLateSubmission = allowLateSubmission,
            ClassId = classId,
            SubjectId = subjectId,
            CreatedByTeacherId = createdByTeacherId,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    // ClassId, SubjectId and CreatedByTeacherId are deliberately absent: moving an assignment to
    // another class would re-scope it under every student who already submitted, and changing the
    // author would hand ownership to a teacher who never agreed to it. Re-creating is the honest
    // way to do either.
    public void Update(
        string title,
        string description,
        DateTime deadline,
        int maxMarks,
        bool allowLateSubmission)
    {
        Title = title;
        Description = description;
        Deadline = deadline;
        MaxMarks = maxMarks;
        AllowLateSubmission = allowLateSubmission;
        UpdatedAt = DateTime.UtcNow;
    }

    // Publishing is the exact moment students can see this (rule 6), which is why it is a named
    // transition rather than a settable Status. Idempotent, so re-publishing is a no-op instead
    // of a spurious UpdatedAt bump. Authorization happens in the service, above this.
    public void Publish()
    {
        if (Status == AssignmentStatus.Published)
        {
            return;
        }

        Status = AssignmentStatus.Published;
        UpdatedAt = DateTime.UtcNow;
    }
}
