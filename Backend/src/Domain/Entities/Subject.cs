namespace AssignmentSystem.Domain.Entities;

// A Subject belongs to exactly one Class — "Mathematics in Class 10-A" is a different row
// from "Mathematics in Class 10-B". This keeps TeacherAssignment's uniqueness meaningful:
// a teacher is granted one subject in one class at a time.
public sealed class Subject
{
    private readonly List<TeacherAssignment> _teacherAssignments = [];
    private readonly List<Assignment> _assignments = [];

    private Subject() { }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;

    public Guid ClassId { get; private set; }
    public Class Class { get; private set; } = null!;

    public IReadOnlyCollection<TeacherAssignment> TeacherAssignments => _teacherAssignments;
    public IReadOnlyCollection<Assignment> Assignments => _assignments;

    public static Subject Create(string name, Guid classId)
    {
        return new Subject
        {
            Id = Guid.NewGuid(),
            Name = name,
            ClassId = classId
        };
    }
}
