using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using Moq;
using AssignmentEntity = AssignmentSystem.Domain.Entities.Assignment;
using SubmissionEntity = AssignmentSystem.Domain.Entities.Submission;

namespace AssignmentSystem.UnitTests.Helpers;

// Two things live here: single-purpose mock factories, and a ServiceMocks bag that holds a whole set
// so a test can construct a real service in one line.
//
// MockBehavior.Strict is deliberately NOT used. Every service touches only some of its dependencies
// on any given path, and Strict would make each test declare setups for calls it does not care about —
// noise that hides the one line that matters. Where "was this even called?" is the actual assertion,
// the tests verify it explicitly instead.
internal static class MockRepositoryHelper
{
    // --- Current user ---------------------------------------------------------------------------

    internal static Mock<ICurrentUserService> CurrentUser(Guid userId, Role role)
    {
        var mock = new Mock<ICurrentUserService>();
        mock.SetupGet(c => c.UserId).Returns(userId);
        // Role travels as the raw claim string, exactly as CurrentUserService reads it off the JWT.
        mock.SetupGet(c => c.Role).Returns(role.ToString());
        mock.SetupGet(c => c.IsAuthenticated).Returns(true);
        return mock;
    }

    // For the "service must not trust the [Authorize] attribute" paths: a token with no usable sub.
    internal static Mock<ICurrentUserService> AnonymousUser()
    {
        var mock = new Mock<ICurrentUserService>();
        mock.SetupGet(c => c.UserId).Returns((Guid?)null);
        mock.SetupGet(c => c.Role).Returns((string?)null);
        mock.SetupGet(c => c.IsAuthenticated).Returns(false);
        return mock;
    }

    // --- Assignments ----------------------------------------------------------------------------

    // Every assignment mock gets a completion-stats setup, and that is a hazard fix rather than a
    // convenience. Moq's default for an unstubbed `Task<IReadOnlyDictionary<…>>` is a completed task
    // carrying **null**, and the teacher/admin list path indexes into that dictionary — so without this,
    // every existing test that pages assignments as a teacher or an admin throws a
    // NullReferenceException that reads like a product bug and is a missing setup.
    //
    // Zeroes by default, so a test that does not care about completion sees "nobody enrolled, nobody
    // submitted" rather than a crash. Tests that do care call WithCompletion below.
    internal static Mock<IAssignmentRepository> WithDefaultCompletion(
        this Mock<IAssignmentRepository> mock)
    {
        mock.Setup(r => r.GetCompletionStatsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompletionStats(0, 0));

        // Echoes back a zeroed entry for every id asked about, which is the contract the real repository
        // promises: every requested assignment is present, missing rows read as zero.
        mock.Setup(r => r.GetCompletionStatsAsync(
                It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IReadOnlyCollection<Guid> ids, CancellationToken _) =>
                (IReadOnlyDictionary<Guid, CompletionStats>)ids.ToDictionary(
                    id => id, _ => new CompletionStats(0, 0)));

        return mock;
    }

    // Real figures, for the tests that assert on the percentage. Applies to both overloads so it does not
    // matter whether the test reads one assignment or a page of them.
    internal static Mock<IAssignmentRepository> WithCompletion(
        this Mock<IAssignmentRepository> mock,
        int totalEnrolled,
        int totalSubmitted)
    {
        var stats = new CompletionStats(totalEnrolled, totalSubmitted);

        mock.Setup(r => r.GetCompletionStatsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(stats);
        mock.Setup(r => r.GetCompletionStatsAsync(
                It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IReadOnlyCollection<Guid> ids, CancellationToken _) =>
                (IReadOnlyDictionary<Guid, CompletionStats>)ids.ToDictionary(id => id, _ => stats));

        return mock;
    }

    // The teacher/admin read path. Matches on the assignment's own id, so a lookup for any other id
    // falls through to the mock's default (null) — which is exactly the not-found case.
    internal static Mock<IAssignmentRepository> AssignmentsWith(AssignmentEntity assignment)
    {
        var mock = new Mock<IAssignmentRepository>();
        mock.Setup(r => r.GetByIdAsync(assignment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(assignment);
        return mock.WithDefaultCompletion();
    }

    // Every id returns null: the 404 arrangement.
    internal static Mock<IAssignmentRepository> AssignmentsEmpty()
    {
        var mock = new Mock<IAssignmentRepository>();
        mock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AssignmentEntity?)null);
        mock.Setup(r => r.GetPublishedForStudentAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AssignmentEntity?)null);
        return mock.WithDefaultCompletion();
    }

    // The student read path (rules 3 + 6). Set visible: false to model a draft, or an assignment in a
    // class the student is not enrolled in — the repository returns null for both, and the service
    // cannot tell them apart, which is the point of assumption A7.
    internal static Mock<IAssignmentRepository> AssignmentsForStudent(
        AssignmentEntity assignment,
        Guid studentId,
        bool visible = true)
    {
        var mock = new Mock<IAssignmentRepository>();
        mock.Setup(r => r.GetPublishedForStudentAsync(
                assignment.Id, studentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(visible ? assignment : null);
        mock.Setup(r => r.GetByIdAsync(assignment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(assignment);
        return mock.WithDefaultCompletion();
    }

    internal static Mock<IAssignmentRepository> WithPage(
        this Mock<IAssignmentRepository> mock,
        params AssignmentEntity[] assignments)
    {
        var page = new PagedResult<AssignmentEntity>(
            assignments, 1, PaginationQuery.DefaultPageSize, assignments.Length);

        mock.Setup(r => r.GetPagedForTeacherAsync(
                It.IsAny<Guid>(), It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(page);
        mock.Setup(r => r.GetPagedForStudentAsync(
                It.IsAny<Guid>(), It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(page);
        mock.Setup(r => r.GetPagedForAdminAsync(
                It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(page);

        return mock;
    }

    internal static Mock<IAssignmentRepository> WithSubmissions(
        this Mock<IAssignmentRepository> mock,
        bool hasSubmissions)
    {
        mock.Setup(r => r.HasSubmissionsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(hasSubmissions);
        return mock;
    }

    // --- Submissions ----------------------------------------------------------------------------

    internal static Mock<ISubmissionRepository> SubmissionsWith(SubmissionEntity submission)
    {
        var mock = new Mock<ISubmissionRepository>();
        mock.Setup(r => r.GetByIdAsync(submission.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(submission);
        mock.Setup(r => r.GetByAssignmentAndStudentAsync(
                submission.AssignmentId, submission.StudentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(submission);
        mock.Setup(r => r.ExistsForAssignmentAndStudentAsync(
                submission.AssignmentId, submission.StudentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        return mock;
    }

    // Nothing submitted yet: /mine is a 404 and a new submission is allowed through (A4 satisfied).
    internal static Mock<ISubmissionRepository> SubmissionsEmpty()
    {
        var mock = new Mock<ISubmissionRepository>();
        mock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubmissionEntity?)null);
        mock.Setup(r => r.GetByAssignmentAndStudentAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SubmissionEntity?)null);
        mock.Setup(r => r.ExistsForAssignmentAndStudentAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        return mock;
    }

    // --- Classes (the rule-4 gate) --------------------------------------------------------------

    // isAssigned is the single switch behind every rule-4 test: true for "teacher holds this
    // class+subject", false for "not assigned" -> 403.
    internal static Mock<IClassRepository> Classes(
        bool isAssigned = true,
        Class? @class = null,
        Subject? subject = null)
    {
        var mock = new Mock<IClassRepository>();

        mock.Setup(r => r.TeacherAssignmentExistsAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(isAssigned);

        if (@class is not null)
        {
            mock.Setup(r => r.GetByIdAsync(@class.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(@class);
        }

        if (subject is not null)
        {
            mock.Setup(r => r.GetSubjectByIdAsync(subject.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(subject);
        }

        return mock;
    }

    // Set up so the *only* teacherId that returns rows is the one passed here. A setup matching
    // It.IsAny<Guid>() would return the same scope for every teacher and quietly pass a service that
    // ignored the caller's identity — which is the one thing this query must get right.
    internal static Mock<IClassRepository> WithTeachingScope(
        this Mock<IClassRepository> mock,
        Guid teacherId,
        params TeacherAssignment[] teachingAssignments)
    {
        var page = new PagedResult<TeacherAssignment>(
            teachingAssignments, 1, PaginationQuery.DefaultPageSize, teachingAssignments.Length);

        mock.Setup(r => r.GetTeachingScopePagedAsync(
                teacherId, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(page);

        return mock;
    }

    // The admin roster reads. Like WithTeachingScope, the setup matches one classId only — an
    // It.IsAny<Guid>() setup would hand back the same roster for every class and quietly pass a service
    // that ignored the id in the route.
    internal static Mock<IClassRepository> WithClassTeachers(
        this Mock<IClassRepository> mock,
        Guid classId,
        params TeacherAssignment[] teacherAssignments)
    {
        mock.Setup(r => r.GetClassTeacherAssignmentsPagedAsync(
                classId, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<TeacherAssignment>(
                teacherAssignments, 1, PaginationQuery.DefaultPageSize, teacherAssignments.Length));

        return mock;
    }

    internal static Mock<IClassRepository> WithClassStudents(
        this Mock<IClassRepository> mock,
        Guid classId,
        params StudentEnrollment[] enrollments)
    {
        mock.Setup(r => r.GetClassEnrollmentsPagedAsync(
                classId, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<StudentEnrollment>(
                enrollments, 1, PaginationQuery.DefaultPageSize, enrollments.Length));

        return mock;
    }

    // The student's own view of the same rows WithClassStudents arranges. Matched on studentId for the same
    // reason: an It.IsAny setup would return one student's enrolments for every caller, which is precisely
    // the bug this endpoint must not have.
    internal static Mock<IClassRepository> WithStudentEnrollments(
        this Mock<IClassRepository> mock,
        Guid studentId,
        params StudentEnrollment[] enrollments)
    {
        mock.Setup(r => r.GetStudentEnrollmentsPagedAsync(
                studentId, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<StudentEnrollment>(
                enrollments, 1, PaginationQuery.DefaultPageSize, enrollments.Length));

        return mock;
    }

    // "This student is in this class." Matched on the pair, so a query about any other pair falls through to
    // the mock's default of false — which is the not-enrolled case the classmates gate turns into a 404.
    internal static Mock<IClassRepository> WithEnrollment(
        this Mock<IClassRepository> mock,
        Guid studentId,
        Guid classId)
    {
        mock.Setup(r => r.EnrollmentExistsAsync(studentId, classId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        return mock;
    }

    // --- Users ----------------------------------------------------------------------------------

    internal static Mock<IUserRepository> UsersWith(params User[] users)
    {
        var mock = new Mock<IUserRepository>();

        foreach (var user in users)
        {
            mock.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(user);
            mock.Setup(r => r.GetByEmailAsync(user.Email, It.IsAny<CancellationToken>()))
                .ReturnsAsync(user);
        }

        return mock;
    }

    // --- A whole dependency set -----------------------------------------------------------------

    // Holds every mock a service needs, so a test constructs the real service in one line and then
    // reaches into whichever mock it wants to reconfigure or verify.
    internal sealed class ServiceMocks
    {
        // WithDefaultCompletion here as well as in the factories: a test that leaves this at its default and
        // pages assignments as a teacher would otherwise hit the null-dictionary trap described above.
        internal Mock<IAssignmentRepository> Assignments { get; init; } =
            new Mock<IAssignmentRepository>().WithDefaultCompletion();
        internal Mock<ISubmissionRepository> Submissions { get; init; } = new();
        internal Mock<IClassRepository> Classes { get; init; } = new();
        internal Mock<IUserRepository> Users { get; init; } = new();
        internal Mock<ICurrentUserService> CurrentUser { get; init; } = new();
        internal Mock<IPasswordHasher> PasswordHasher { get; init; } = new();

        // Asserts the obvious follow-up to any successful mutation: it was actually persisted.
        // Forgetting SaveChangesAsync produces a service that returns 200 and changes nothing.
        internal void VerifyAssignmentSaved(Times times) =>
            Assignments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), times);

        internal void VerifySubmissionSaved(Times times) =>
            Submissions.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), times);
    }
}
