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

    // Admin-driven edit. The hash is deliberately not a parameter: bundling it here would mean every
    // profile edit had to supply one, and the caller that had none would be tempted to pass the
    // existing value back through — a plaintext round trip waiting to happen.
    public void Update(string fullName, string email, Role role)
    {
        FullName = fullName;
        Email = email;
        Role = role;
    }

    // Takes an already-hashed value: hashing lives in Infrastructure, and this entity must never see
    // a plaintext password it could accidentally persist.
    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;

    // What a user may change about themselves, which is their display name and nothing else.
    //
    // A separate method from Update above rather than a call into it with the existing email and role passed
    // back in. Those two are an administrator's to set — an email is an identity and a role is an authority —
    // and routing a self-service edit through a method that *accepts* them would mean the only thing stopping
    // a user from changing their own role is the caller remembering not to. Here it is structural.
    public void UpdateProfile(string fullName) => FullName = fullName;
}
