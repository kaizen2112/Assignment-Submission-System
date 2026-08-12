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
