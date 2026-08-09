using AssignmentSystem.Application.Interfaces;

namespace AssignmentSystem.Infrastructure.Auth;

public sealed class BcryptPasswordHasher : IPasswordHasher
{
    // Exponential cost factor: each +1 doubles the work an attacker repeats per guess. 12 is the
    // current production-grade minimum. Must stay in step with DataSeeder.WorkFactor, or the users
    // table ends up with mixed costs again.
    public const int WorkFactor = 12;

    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    // Verify reads the cost out of the stored hash, so raising WorkFactor later does not invalidate
    // existing passwords.
    public bool Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
}
