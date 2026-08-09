namespace AssignmentSystem.Domain.Entities;

// The authorization gate for rule 4. Before a teacher creates, edits, or grades anything,
// the service checks a row exists here for (TeacherId, SubjectId, ClassId). Modelled as an
// explicit entity rather than a many-to-many nav property because it is queried directly on
// every teacher mutation and carries AssignedAt.
//
// ClassId is stored even though Subject already knows its class: it lets the guard check
// resolve in one indexed lookup instead of joining through Subject.
public sealed class TeacherAssignment
{
    private TeacherAssignment() { }

    public Guid Id { get; private set; }

    public Guid TeacherId { get; private set; }
    public User Teacher { get; private set; } = null!;

    public Guid SubjectId { get; private set; }
    public Subject Subject { get; private set; } = null!;

    public Guid ClassId { get; private set; }
    public Class Class { get; private set; } = null!;

    public DateTime AssignedAt { get; private set; }

    public static TeacherAssignment Create(Guid teacherId, Guid subjectId, Guid classId)
    {
        return new TeacherAssignment
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            SubjectId = subjectId,
            ClassId = classId,
            AssignedAt = DateTime.UtcNow
        };
    }
}
