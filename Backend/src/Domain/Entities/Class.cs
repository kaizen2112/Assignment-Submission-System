namespace AssignmentSystem.Domain.Entities;

public sealed class Class
{
    private readonly List<Subject> _subjects = [];
    private readonly List<StudentEnrollment> _enrollments = [];
    private readonly List<Assignment> _assignments = [];

    private Class() { }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = null!;

    // Short human-readable handle ("10A"). Unique, so admins can refer to a class without
    // pasting a Guid.
    public string Code { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }

    public IReadOnlyCollection<Subject> Subjects => _subjects;
    public IReadOnlyCollection<StudentEnrollment> Enrollments => _enrollments;
    public IReadOnlyCollection<Assignment> Assignments => _assignments;

    public static Class Create(string name, string code)
    {
        return new Class
        {
            Id = Guid.NewGuid(),
            Name = name,
            Code = code,
            CreatedAt = DateTime.UtcNow
        };
    }
}
