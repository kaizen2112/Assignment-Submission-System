using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context) => _context = context;

    // Case-insensitive on purpose: "Admin@School.com" is the same account as "admin@school.com",
    // and a case-sensitive lookup would let a user fail to log in with their own address.
    // ILIKE has no wildcards here, so this is an equality match, and the unique index on Email
    // keeps it single-row.
    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        _context.Users.FirstOrDefaultAsync(u => EF.Functions.ILike(u.Email, email), cancellationToken);

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

    public Task<PagedResult<User>> GetPagedAsync(
        PaginationQuery pagination,
        Role? role = null,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Users.AsNoTracking();

        if (role is { } filterRole)
        {
            query = query.Where(u => u.Role == filterRole);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{EscapeLikePattern(search.Trim())}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.FullName, pattern) || EF.Functions.ILike(u.Email, pattern));
        }

        return ApplySort(query, pagination).ToPagedResultAsync(pagination, cancellationToken);
    }

    public Task<bool> EmailExistsAsync(
        string email,
        Guid? excludeUserId = null,
        CancellationToken cancellationToken = default) =>
        _context.Users.AnyAsync(
            u => EF.Functions.ILike(u.Email, email) && (excludeUserId == null || u.Id != excludeUserId),
            cancellationToken);

    // Two separate queries with an early exit rather than one OR across a join: the common case is
    // a user with no records at all, and the first Any then costs a single index probe.
    public async Task<bool> HasAcademicRecordsAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (await _context.Assignments.AnyAsync(a => a.CreatedByTeacherId == userId, cancellationToken))
        {
            return true;
        }

        return await _context.Submissions.AnyAsync(s => s.StudentId == userId, cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken = default) =>
        await _context.Users.AddAsync(user, cancellationToken);

    public void Remove(User user) => _context.Users.Remove(user);

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        _context.SaveChangesAsync(cancellationToken);

    // A bare "%" or "_" typed into a search box is a literal character to the user but a wildcard to
    // ILIKE — searching for "_" would otherwise match every single row.
    private static string EscapeLikePattern(string value) => value
        .Replace("\\", "\\\\")
        .Replace("%", "\\%")
        .Replace("_", "\\_");

    private static IQueryable<User> ApplySort(IQueryable<User> query, PaginationQuery pagination)
    {
        var descending = pagination.SortDescending;

        return pagination.SortBy?.ToLowerInvariant() switch
        {
            "fullname" => descending
                ? query.OrderByDescending(u => u.FullName).ThenBy(u => u.Id)
                : query.OrderBy(u => u.FullName).ThenBy(u => u.Id),
            "email" => descending
                ? query.OrderByDescending(u => u.Email).ThenBy(u => u.Id)
                : query.OrderBy(u => u.Email).ThenBy(u => u.Id),
            "role" => descending
                ? query.OrderByDescending(u => u.Role).ThenBy(u => u.Id)
                : query.OrderBy(u => u.Role).ThenBy(u => u.Id),
            _ => descending
                ? query.OrderByDescending(u => u.CreatedAt).ThenBy(u => u.Id)
                : query.OrderBy(u => u.CreatedAt).ThenBy(u => u.Id)
        };
    }
}
