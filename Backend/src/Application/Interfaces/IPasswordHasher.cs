namespace AssignmentSystem.Application.Interfaces;

// BCrypt lives in Infrastructure, so Application depends on this instead. It also gives the work
// factor exactly one home — the mixed $2a$11$/$2a$12$ situation from Phase 1 came from hashing in
// two places with different defaults.
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string hash);
}
