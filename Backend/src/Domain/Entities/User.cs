using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

// One table for all three roles. Role-specific data is held in the join entities
// (TeacherAssignments, Enrollments) rather than in subclasses, so a role change is a
// single column update instead of a row migration between tables.
public sealed class User
{
    private readonly List<TeacherAssignment> _teacherAssignments = [];
    private readonly List<StudentEnrollment> _enrollments = [];
    private readonly List<Submission> _submissions = [];

    // EF Core materializes rows through this. Application code must use Create, which is
    // the single place invariants get enforced.
    private User() { }

    public Guid Id { get; private set; }

    // `null!` silences the nullable analyser for properties EF assigns after construction.
    // Create always populates them, so they are never actually null at runtime.
    public string FullName { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string PasswordHash { get; private set; } = null!;
    public Role Role { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Exposed as IReadOnlyCollection over a private list so callers cannot .Add() a
    // relationship behind the aggregate's back — mutation goes through a method that can
    // check the invariant. List<T> already implements IReadOnlyCollection<T>, so this
    // needs no defensive copy.
    public IReadOnlyCollection<TeacherAssignment> TeacherAssignments => _teacherAssignments;
    public IReadOnlyCollection<StudentEnrollment> Enrollments => _enrollments;
    public IReadOnlyCollection<Submission> Submissions => _submissions;

    public static User Create(string fullName, string email, string passwordHash, Role role)
    {
        return new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Email = email,
            PasswordHash = passwordHash,
            Role = role,
            CreatedAt = DateTime.UtcNow
        };
    }
}
