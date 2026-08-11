namespace AssignmentSystem.Domain.Entities;

// Scopes what a student can see (rules 3 and 6). Assignment queries for a student are
// filtered to the classes they have a row here for, so an unenrolled student gets an empty
// result at the query level rather than a hidden-in-the-UI result.
public sealed class StudentEnrollment
{
    private StudentEnrollment() { }

    public Guid Id { get; private set; }

    public Guid StudentId { get; private set; }
    // internal set, like the navigations on TeacherAssignment: EF fills these and no factory does, but
    // the admin roster response reads Student.FullName, so a unit test needs to arrange it. See
    // Domain/AssemblyInfo.cs for why internal rather than public.
    public User Student { get; internal set; } = null!;

    public Guid ClassId { get; private set; }
    public Class Class { get; internal set; } = null!;

    public DateTime EnrolledAt { get; private set; }

    public static StudentEnrollment Create(Guid studentId, Guid classId)
    {
        return new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            StudentId = studentId,
            ClassId = classId,
            EnrolledAt = DateTime.UtcNow
        };
    }
}
