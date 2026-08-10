using AssignmentSystem.Application.Common;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    // Admin user list. role and search are both optional narrowing filters.
    Task<PagedResult<User>> GetPagedAsync(
        PaginationQuery pagination,
        Role? role = null,
        string? search = null,
        CancellationToken cancellationToken = default);

    // excludeUserId lets an update re-submit the user's own unchanged email without tripping a
    // false duplicate — without it, editing only a name would fail.
    Task<bool> EmailExistsAsync(
        string email,
        Guid? excludeUserId = null,
        CancellationToken cancellationToken = default);

    // The FKs on assignments.CreatedByTeacherId and submissions.StudentId are ON DELETE RESTRICT,
    // so deleting a teacher who authored work fails at the database. Asking first turns that into a
    // 409 with an explanation, and keeps the DbUpdateException type out of the Application layer.
    Task<bool> HasAcademicRecordsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);

    void Remove(User user);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
