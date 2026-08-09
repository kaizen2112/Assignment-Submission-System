namespace AssignmentSystem.Domain.Enums;

// Persisted as a string and carried in the JWT role claim, so member *names* are the
// contract — renaming one breaks existing rows and issued tokens. Reordering is safe.
public enum Role
{
    Admin,
    Teacher,
    Student
}
