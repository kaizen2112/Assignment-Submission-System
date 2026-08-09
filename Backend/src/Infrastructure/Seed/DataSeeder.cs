using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Infrastructure.Auth;
using AssignmentSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Seed;

// Development-only sample data. The evaluator's first login should land on populated screens
// rather than an empty shell, and the three demo accounts in the README have to actually exist.
public static class DataSeeder
{
    // Matches the credentials published in README.md. Plain text here is deliberate: these are
    // throwaway demo logins for a local database, and hashing happens below before insert.
    private const string AdminPassword = "Admin@123";
    private const string TeacherPassword = "Teacher@123";
    private const string StudentPassword = "Student@123";

    // Deliberately reuses the hasher's constant rather than declaring its own. Phase 1 shipped a
    // local default here and ended up with $2a$11$ hashes against a documented 12 — one constant
    // makes that drift impossible.
    private const int WorkFactor = BcryptPasswordHasher.WorkFactor;

    public static async Task SeedAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        // Idempotency gate. Any existing user means a previous run already populated the graph,
        // and re-inserting would trip the unique indexes on email, class code and enrollment.
        if (await context.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var admin = User.Create("System Admin", "admin@school.com", Hash(AdminPassword), Role.Admin);

        var teacher1 = User.Create("Ayesha Rahman", "teacher1@school.com", Hash(TeacherPassword), Role.Teacher);
        var teacher2 = User.Create("Imran Hossain", "teacher2@school.com", Hash(TeacherPassword), Role.Teacher);

        var student1 = User.Create("Nadia Islam", "student1@school.com", Hash(StudentPassword), Role.Student);
        var student2 = User.Create("Rafid Karim", "student2@school.com", Hash(StudentPassword), Role.Student);
        var student3 = User.Create("Tanvir Ahmed", "student3@school.com", Hash(StudentPassword), Role.Student);

        await context.Users.AddRangeAsync(
            [admin, teacher1, teacher2, student1, student2, student3],
            cancellationToken);

        var class10A = Class.Create("Class 10 - A", "10A");
        var class10B = Class.Create("Class 10 - B", "10B");

        await context.Classes.AddRangeAsync([class10A, class10B], cancellationToken);

        // A Subject belongs to one Class, so "Mathematics" here means Mathematics-in-10A.
        var maths = Subject.Create("Mathematics", class10A.Id);
        var english = Subject.Create("English", class10A.Id);
        var science = Subject.Create("Science", class10B.Id);

        await context.Subjects.AddRangeAsync([maths, english, science], cancellationToken);

        // teacher2 is deliberately given only Science in 10B. That makes the rule-4 and rule-7
        // cross-role checks demonstrable by hand: teacher2 hitting a 10A assignment must 403.
        await context.TeacherAssignments.AddRangeAsync(
        [
            TeacherAssignment.Create(teacher1.Id, maths.Id, class10A.Id),
            TeacherAssignment.Create(teacher1.Id, english.Id, class10A.Id),
            TeacherAssignment.Create(teacher2.Id, science.Id, class10B.Id)
        ], cancellationToken);

        // student3 sits in 10B, so it can be shown that 10A's assignments are invisible to them.
        await context.StudentEnrollments.AddRangeAsync(
        [
            StudentEnrollment.Create(student1.Id, class10A.Id),
            StudentEnrollment.Create(student2.Id, class10A.Id),
            StudentEnrollment.Create(student3.Id, class10B.Id)
        ], cancellationToken);

        var now = DateTime.UtcNow;

        // Deadline already passed, late submissions refused — the rule-1 rejection path.
        var algebraSheet = Assignment.Create(
            "Algebra Problem Set 1",
            "Solve questions 1-15 from chapter 3. Show your working for each step.",
            now.AddDays(-2),
            maxMarks: 100,
            classId: class10A.Id,
            subjectId: maths.Id,
            createdByTeacherId: teacher1.Id);

        // Deadline open and late submissions allowed — the rule-1 acceptance path.
        var bookReview = Assignment.Create(
            "Book Review: Things Fall Apart",
            "Write a 500-word review covering theme, character and setting.",
            now.AddDays(7),
            maxMarks: 50,
            classId: class10A.Id,
            subjectId: english.Id,
            createdByTeacherId: teacher1.Id,
            allowLateSubmission: true);

        // Left as a Draft: students must not see this one at all (rule 6).
        var labReport = Assignment.Create(
            "Photosynthesis Lab Report",
            "Record your observations from the leaf-disc experiment and explain the results.",
            now.AddDays(14),
            maxMarks: 20,
            classId: class10B.Id,
            subjectId: science.Id,
            createdByTeacherId: teacher2.Id);

        // Status is never assigned directly — Create always yields Draft, so the two published
        // ones go through the same transition a teacher would use.
        algebraSheet.Publish();
        bookReview.Publish();

        await context.Assignments.AddRangeAsync(
            [algebraSheet, bookReview, labReport],
            cancellationToken);

        var gradedByNadia = Submission.Create(
            algebraSheet.Id,
            student1.Id,
            "Q1: x = 4. Q2: x = -3. Q3: no real solution because the discriminant is negative.",
            isLate: false);
        gradedByNadia.Grade(85, "Strong work. Show the discriminant step explicitly next time.");

        var gradedByRafid = Submission.Create(
            algebraSheet.Id,
            student2.Id,
            "Q1: x = 4. Q2: x = 3. Q3: skipped.",
            isLate: false);
        gradedByRafid.Grade(62, "Q2 has a sign error and Q3 is missing. Review factorising.");

        // Left ungraded so a teacher's grading queue is not empty on first login.
        var pendingByNadia = Submission.Create(
            bookReview.Id,
            student1.Id,
            "Achebe uses Okonkwo's rigidity to show how a culture under pressure turns on itself...",
            isLate: false);

        await context.Submissions.AddRangeAsync(
            [gradedByNadia, gradedByRafid, pendingByNadia],
            cancellationToken);

        // One SaveChanges for the whole graph: either the sample data is complete or the database
        // stays empty, never half-populated.
        await context.SaveChangesAsync(cancellationToken);
    }

    private static string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
}
