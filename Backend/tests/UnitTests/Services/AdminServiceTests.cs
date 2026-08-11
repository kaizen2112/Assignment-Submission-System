using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Moq;

namespace AssignmentSystem.UnitTests.Services;

// Covers the two class-roster reads added for the admin UI. They are the read halves of
// AssignTeacherAsync and EnrollStudentAsync — the grants that drive rules 3 and 4 — so the property
// worth pinning is that each is scoped to the class in the route and to nothing wider.
//
// Scope note, same as AssignmentServiceTests: a mocked repository cannot prove the SQL filters by
// ClassId. What is provable here is that the service passes the route's id through unchanged and never
// falls back to a query for a different class, which is what the WithClassTeachers/WithClassStudents
// helpers are built to catch — each answers for one classId only.
public sealed class AdminServiceTests
{
    private static AdminService Build(MockRepositoryHelper.ServiceMocks mocks) =>
        new(
            mocks.Users.Object,
            mocks.Classes.Object,
            mocks.PasswordHasher.Object,
            mocks.CurrentUser.Object);

    // A mocks bag whose class repository knows about exactly the classes passed here. Any other id
    // falls through to Moq's default of null, which is the 404 arrangement.
    private static MockRepositoryHelper.ServiceMocks WithClasses(params Class[] classes)
    {
        var repository = new Mock<IClassRepository>();

        foreach (var @class in classes)
        {
            repository.Setup(r => r.GetByIdAsync(@class.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(@class);
        }

        return new MockRepositoryHelper.ServiceMocks { Classes = repository };
    }

    // =============================================================================================
    // Teacher roster — GET /admin/classes/{id}/teachers
    // =============================================================================================

    [Fact]
    public async Task GetClassTeachersAsync_ReturnsTeacherAndSubjectNames()
    {
        // Arrange
        var @class = EntityBuilders.Class();
        var subject = EntityBuilders.Subject(@class.Id, "Physics");
        var teacher = EntityBuilders.Teacher("Rafiq Ahmed", "rafiq@school.com");

        var teacherAssignment = EntityBuilders.TeacherAssignment(teacher.Id, @class, subject);
        teacherAssignment.Teacher = teacher;

        var mocks = WithClasses(@class);
        mocks.Classes.WithClassTeachers(@class.Id, teacherAssignment);

        // Act
        var result = await Build(mocks).GetClassTeachersAsync(
            @class.Id, new PagedQueryParameters(), CancellationToken.None);

        // Assert — names, not ids. An id-only roster would be unreadable on screen, which is the whole
        // reason this endpoint exists rather than the UI joining three lists client-side.
        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().HaveCount(1);
        result.Value.Items[0].TeacherName.Should().Be("Rafiq Ahmed");
        result.Value.Items[0].SubjectName.Should().Be("Physics");
        result.Value.Items[0].ClassName.Should().Be(@class.Name);
    }

    [Fact]
    public async Task GetClassTeachersAsync_ClassWithNoTeachers_ReturnsEmptyPageNotNotFound()
    {
        // Arrange — a real class that nobody teaches yet. Every class is in this state for the minute
        // between creating it and assigning a teacher, so it must not read as an error.
        var @class = EntityBuilders.Class();

        var mocks = WithClasses(@class);
        mocks.Classes.WithClassTeachers(@class.Id);

        // Act
        var result = await Build(mocks).GetClassTeachersAsync(
            @class.Id, new PagedQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetClassTeachersAsync_UnknownClass_ReturnsNotFound()
    {
        // Arrange — no class registered, so every id returns null.
        var mocks = WithClasses();

        // Act
        var result = await Build(mocks).GetClassTeachersAsync(
            Guid.NewGuid(), new PagedQueryParameters(), CancellationToken.None);

        // Assert — distinct from the empty-roster case above: "no such class" and "class with no
        // teachers" are different answers, and the API says so with different status codes.
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task GetClassTeachersAsync_OversizedPageSize_IsRejectedBeforeTheClassLookup()
    {
        // Arrange
        var mocks = WithClasses();
        var query = new PagedQueryParameters { PageSize = PaginationQuery.MaxPageSize + 1 };

        // Act
        var result = await Build(mocks).GetClassTeachersAsync(
            Guid.NewGuid(), query, CancellationToken.None);

        // Assert — a Validation failure (400), not NotFound, even though the class does not exist
        // either. Ordering the two checks the other way would report the wrong problem for a request
        // that has both.
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);
        result.Error.Should().Contain(PaginationQuery.MaxPageSize.ToString());

        mocks.Classes.Verify(
            r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never(),
            "an invalid page size should not cost a database round trip");
    }

    // =============================================================================================
    // Student roster — GET /admin/classes/{id}/students
    // =============================================================================================

    [Fact]
    public async Task GetClassStudentsAsync_ReturnsStudentNames()
    {
        // Arrange
        var @class = EntityBuilders.Class();
        var student = EntityBuilders.Student("Mina Rahman", "mina@school.com");

        var mocks = WithClasses(@class);
        mocks.Classes.WithClassStudents(@class.Id, EntityBuilders.Enrollment(student, @class));

        // Act
        var result = await Build(mocks).GetClassStudentsAsync(
            @class.Id, new PagedQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().HaveCount(1);
        result.Value.Items[0].StudentName.Should().Be("Mina Rahman");
        result.Value.Items[0].StudentId.Should().Be(student.Id);
        result.Value.Items[0].ClassName.Should().Be(@class.Name);
    }

    [Fact]
    public async Task GetClassStudentsAsync_DoesNotReturnAnotherClassRoster()
    {
        // Arrange — two real classes. 9B has an enrolled student; 10A has none. Asking for 10A must
        // come back empty, which is the one way a roster endpoint could leak.
        var requested = EntityBuilders.Class("Class 10 - A", "10A");
        var other = EntityBuilders.Class("Class 9 - B", "9B");
        var student = EntityBuilders.Student();

        var mocks = WithClasses(requested, other);
        mocks.Classes.WithClassStudents(requested.Id);
        mocks.Classes.WithClassStudents(other.Id, EntityBuilders.Enrollment(student, other));

        // Act
        var result = await Build(mocks).GetClassStudentsAsync(
            requested.Id, new PagedQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().BeEmpty();

        mocks.Classes.Verify(
            r => r.GetClassEnrollmentsPagedAsync(
                other.Id, It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never(),
            "the roster query must use the id from the route and no other");
    }

    [Fact]
    public async Task GetClassStudentsAsync_UnknownClass_ReturnsNotFound()
    {
        // Arrange
        var mocks = WithClasses();

        // Act
        var result = await Build(mocks).GetClassStudentsAsync(
            Guid.NewGuid(), new PagedQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
    }
}
