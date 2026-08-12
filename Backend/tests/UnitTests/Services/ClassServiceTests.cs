using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Moq;

namespace AssignmentSystem.UnitTests.Services;

// A student reading which classes they are enrolled in.
//
// One rule carries the whole endpoint: the student id comes from the token, never from the request. These
// tests assert that the service asks the repository for *the caller's* enrolments — the failure mode worth
// guarding against is not a wrong page shape, it is a page belonging to somebody else.
public sealed class ClassServiceTests
{
    [Fact]
    public async Task GetMyClassesAsync_Student_ReturnsTheirOwnEnrollments()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var maths = EntityBuilders.Class("Class 10 - A", "10A");
        var enrollment = EntityBuilders.Enrollment(student, maths);

        var classes = MockRepositoryHelper.Classes().WithStudentEnrollments(student.Id, enrollment);

        // Act
        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student).Object)
            .GetMyClassesAsync(new PagedQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var row = result.Value.Items.Should().ContainSingle().Subject;
        row.ClassId.Should().Be(maths.Id);
        row.ClassName.Should().Be("Class 10 - A");

        // The code as well as the name: two classes can read almost identically and the code is what
        // distinguishes them on a timetable.
        row.ClassCode.Should().Be("10A");
    }

    [Fact]
    public async Task GetMyClassesAsync_AsksForTheCallersIdAndNoOther()
    {
        // The point of the endpoint. A service that passed any other id — a request field, a hard-coded
        // value, Guid.Empty — would still return a well-formed page, so the assertion has to be about
        // *which* id reached the repository rather than about the shape of the answer.
        var student = EntityBuilders.Student();
        var other = EntityBuilders.Student("Someone Else", "other@test.com");

        var classes = MockRepositoryHelper.Classes()
            .WithStudentEnrollments(student.Id, EntityBuilders.Enrollment(student, EntityBuilders.Class()));

        await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student).Object)
            .GetMyClassesAsync(new PagedQueryParameters(), CancellationToken.None);

        classes.Verify(
            r => r.GetStudentEnrollmentsPagedAsync(
                student.Id, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Once());

        classes.Verify(
            r => r.GetStudentEnrollmentsPagedAsync(
                other.Id, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task GetMyClassesAsync_StudentWithNoEnrollments_ReturnsEmptyPageNotNotFound()
    {
        // A student who exists but has not been enrolled yet is a normal state during setup, and the
        // dashboard has to be able to say "none" rather than render an error.
        var student = EntityBuilders.Student();

        var classes = MockRepositoryHelper.Classes().WithStudentEnrollments(student.Id);

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student).Object)
            .GetMyClassesAsync(new PagedQueryParameters(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Theory]
    [InlineData(Role.Teacher)]
    [InlineData(Role.Admin)]
    public async Task GetMyClassesAsync_NonStudent_ReturnsForbiddenWithoutQuerying(Role role)
    {
        // The controller's [Authorize(Roles = "Student")] has already refused these; this is the second
        // lock. Asserting the repository was never called matters as much as the status: a service that
        // queried first and refused afterwards would be one refactor away from returning the rows.
        var classes = MockRepositoryHelper.Classes();

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(Guid.NewGuid(), role).Object)
            .GetMyClassesAsync(new PagedQueryParameters(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Forbidden);

        classes.Verify(
            r => r.GetStudentEnrollmentsPagedAsync(
                It.IsAny<Guid>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task GetMyClassesAsync_AnonymousCaller_ReturnsUnauthorized()
    {
        var classes = MockRepositoryHelper.Classes();

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.AnonymousUser().Object)
            .GetMyClassesAsync(new PagedQueryParameters(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Unauthorized);
    }

    // =============================================================================================
    // CLASSMATES — the roster of a class the caller is actually in
    // =============================================================================================

    [Fact]
    public async Task GetClassmatesAsync_EnrolledStudent_ReturnsTheRosterIncludingThemselves()
    {
        var me = EntityBuilders.Student("Nadia Islam", "nadia@test.com");
        var peer = EntityBuilders.Student("Rafid Karim", "rafid@test.com");
        var tenA = EntityBuilders.Class();

        var classes = MockRepositoryHelper.Classes()
            .WithEnrollment(me.Id, tenA.Id)
            .WithClassStudents(
                tenA.Id,
                EntityBuilders.Enrollment(me, tenA),
                EntityBuilders.Enrollment(peer, tenA));

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(me.Id, Role.Student).Object)
            .GetClassmatesAsync(tenA.Id, new PagedQueryParameters(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().HaveCount(2);

        // The caller is in the list, flagged rather than filtered out — a roster with a hole where you should
        // be reads as a bug, and the count then disagrees with what a teacher sees.
        result.Value.Items.Single(c => c.Id == me.Id).IsYou.Should().BeTrue();
        result.Value.Items.Single(c => c.Id == peer.Id).IsYou.Should().BeFalse();
        result.Value.Items.Single(c => c.Id == peer.Id).FullName.Should().Be("Rafid Karim");
    }

    [Fact]
    public async Task GetClassmatesAsync_ClassTheStudentIsNotEnrolledIn_ReturnsNotFoundWithoutReadingIt()
    {
        // 404, not 403: a 403 would confirm the class exists (A7). And the roster must not be fetched at all
        // — a service that read the rows and refused afterwards would have somebody else's class in memory
        // next to the refusal.
        var outsider = EntityBuilders.Student();
        var someoneElsesClass = EntityBuilders.Class("Class 9 - B", "9B");

        var classes = MockRepositoryHelper.Classes()
            .WithClassStudents(someoneElsesClass.Id, EntityBuilders.Enrollment(
                EntityBuilders.Student("Insider", "insider@test.com"), someoneElsesClass));

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(outsider.Id, Role.Student).Object)
            .GetClassmatesAsync(someoneElsesClass.Id, new PagedQueryParameters(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);

        classes.Verify(
            r => r.GetClassEnrollmentsPagedAsync(
                It.IsAny<Guid>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Theory]
    [InlineData(Role.Teacher)]
    [InlineData(Role.Admin)]
    public async Task GetClassmatesAsync_NonStudent_ReturnsForbidden(Role role)
    {
        // A teacher reads a roster through their own screens and an admin through /admin/classes/{id}/students.
        // Neither has classmates, so this route is not theirs.
        var classes = MockRepositoryHelper.Classes();

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(Guid.NewGuid(), role).Object)
            .GetClassmatesAsync(Guid.NewGuid(), new PagedQueryParameters(), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task GetMyClassesAsync_OversizedPageSize_ReturnsValidationFailure()
    {
        // Validated before the read, like the admin roster endpoints: an oversized pageSize is the
        // caller's mistake whether or not they have any enrolments.
        var student = EntityBuilders.Student();
        var classes = MockRepositoryHelper.Classes();

        var result = await new ClassService(
                classes.Object,
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student).Object)
            .GetMyClassesAsync(
                new PagedQueryParameters { PageSize = PaginationQuery.MaxPageSize + 1 },
                CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);

        classes.Verify(
            r => r.GetStudentEnrollmentsPagedAsync(
                It.IsAny<Guid>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }
}
