using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Moq;

namespace AssignmentSystem.UnitTests.Services;

// Covers rule 4 (teacher scoped to their assigned class+subject) and the service-side half of rules 3
// and 6 (role-based query dispatch and draft visibility).
//
// Scope note: the SQL that actually excludes drafts lives in AssignmentRepository.StudentScope, and a
// mocked repository cannot prove a query filters correctly — docs/06 puts query correctness in
// integration testing. What is provable here, and what these tests assert, is that the service routes
// each role to the *correct* repository method and never to a wider one. The filtering itself was
// verified against real PostgreSQL by the Phase 3 Step 1 repository probe.
public sealed class AssignmentServiceTests
{
    private static AssignmentService Build(MockRepositoryHelper.ServiceMocks mocks) =>
        new(mocks.Assignments.Object, mocks.Classes.Object, mocks.CurrentUser.Object);

    private static CreateAssignmentRequest CreateRequest(Guid classId, Guid subjectId) =>
        new(
            "Trigonometry Worksheet",
            "Questions 1 to 12.",
            EntityBuilders.FutureDeadline,
            MaxMarks: 50,
            ClassId: classId,
            SubjectId: subjectId);

    // =============================================================================================
    // RULE 4 — a teacher may only act on a class+subject they hold
    // =============================================================================================

    [Fact]
    public async Task CreateAsync_TeacherAssignedToClass_ReturnsSuccess()
    {
        // Arrange
        var teacher = EntityBuilders.Teacher();
        var @class = EntityBuilders.Class();
        var subject = EntityBuilders.Subject(@class.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Classes = MockRepositoryHelper.Classes(isAssigned: true, @class, subject),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).CreateAsync(
            CreateRequest(@class.Id, subject.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.ClassName.Should().Be(@class.Name);
        result.Value.SubjectName.Should().Be(subject.Name);
        result.Value.CreatedByTeacherId.Should().Be(teacher.Id, "the author comes from the token, not the body");
        mocks.VerifyAssignmentSaved(Times.Once());
    }

    [Fact]
    public async Task CreateAsync_AlwaysStartsAsDraft()
    {
        // Arrange — rule 6 at creation time. CreateAssignmentRequest has no status field at all, so
        // this cannot be bypassed from the wire; the assertion pins that the factory agrees.
        var teacher = EntityBuilders.Teacher();
        var @class = EntityBuilders.Class();
        var subject = EntityBuilders.Subject(@class.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Classes = MockRepositoryHelper.Classes(isAssigned: true, @class, subject),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).CreateAsync(
            CreateRequest(@class.Id, subject.Id), CancellationToken.None);

        // Assert
        result.Value.Status.Should().Be(nameof(AssignmentStatus.Draft));
    }

    [Fact]
    public async Task CreateAsync_TeacherNotAssignedToClass_ReturnsFailure()
    {
        // Arrange
        var teacher = EntityBuilders.Teacher();
        var @class = EntityBuilders.Class();
        var subject = EntityBuilders.Subject(@class.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Classes = MockRepositoryHelper.Classes(isAssigned: false, @class, subject),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).CreateAsync(
            CreateRequest(@class.Id, subject.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        result.Error.Should().Contain("not assigned");
        mocks.Assignments.Verify(
            r => r.AddAsync(It.IsAny<Domain.Entities.Assignment>(), It.IsAny<CancellationToken>()),
            Times.Never());
        mocks.VerifyAssignmentSaved(Times.Never());
    }

    [Fact]
    public async Task CreateAsync_StudentRole_ReturnsForbidden()
    {
        // Arrange — defense in depth. [Authorize(Roles="Teacher")] stops this at the controller, but a
        // student has no TeacherAssignment row either, so rule 4 refuses it independently.
        var student = EntityBuilders.Student();
        var @class = EntityBuilders.Class();
        var subject = EntityBuilders.Subject(@class.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Classes = MockRepositoryHelper.Classes(isAssigned: false, @class, subject),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).CreateAsync(
            CreateRequest(@class.Id, subject.Id), CancellationToken.None);

        // Assert
        result.ErrorType.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task CreateAsync_SubjectBelongsToAnotherClass_ReturnsFailure()
    {
        // Arrange — the (classId, subjectId) pair must agree, or every later scoping query would
        // disagree with itself.
        var teacher = EntityBuilders.Teacher();
        var @class = EntityBuilders.Class();
        var otherClass = EntityBuilders.Class("Class 10 - B", "10B");
        var foreignSubject = EntityBuilders.Subject(otherClass.Id, "Science");

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Classes = MockRepositoryHelper.Classes(isAssigned: true, @class, foreignSubject),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).CreateAsync(
            CreateRequest(@class.Id, foreignSubject.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("does not belong");
        // Checked before rule 4, so a mismatched pair never reaches the authorization lookup.
        mocks.Classes.Verify(
            r => r.TeacherAssignmentExistsAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task CreateAsync_UnknownSubject_ReturnsNotFound()
    {
        // Arrange — existence is checked before authorization, so a typo reads as 404 not 403.
        var teacher = EntityBuilders.Teacher();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).CreateAsync(
            CreateRequest(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.ErrorType.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task UpdateAsync_TeacherDoesNotOwnAssignment_ReturnsForbidden()
    {
        // Arrange — docs/04 scopes update to "own only".
        var owner = EntityBuilders.Teacher("Owner", "owner@test.com");
        var otherTeacher = EntityBuilders.Teacher("Other", "other@test.com");
        var assignment = EntityBuilders.Assignment(teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(otherTeacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).UpdateAsync(
            assignment.Id,
            new UpdateAssignmentRequest("Hijacked", "Edited by someone else.", assignment.Deadline, 50),
            CancellationToken.None);

        // Assert
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        result.Error.Should().Contain("only modify assignments you created");
        assignment.Title.Should().NotBe("Hijacked");
        mocks.VerifyAssignmentSaved(Times.Never());
    }

    [Fact]
    public async Task UpdateAsync_OwnerButNoLongerAssignedToClass_ReturnsForbidden()
    {
        // Arrange — the rule-4 re-check behind the ownership check: an admin revoking the teacher's
        // class assignment must take away their ability to edit, even on work they authored.
        var owner = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment(teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment),
            Classes = MockRepositoryHelper.Classes(isAssigned: false),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).UpdateAsync(
            assignment.Id,
            new UpdateAssignmentRequest("Edited", "Body.", assignment.Deadline, 50),
            CancellationToken.None);

        // Assert
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        result.Error.Should().Contain("not assigned");
    }

    [Fact]
    public async Task UpdateAsync_UnchangedPastDeadline_ReturnsSuccess()
    {
        // Arrange — an overdue assignment must stay editable, or a teacher can never fix a typo in
        // last week's homework.
        var owner = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment(
            deadline: EntityBuilders.PastDeadline, teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };

        // Act — same deadline value, only the title changes.
        var result = await Build(mocks).UpdateAsync(
            assignment.Id,
            new UpdateAssignmentRequest("Corrected title", "Body.", assignment.Deadline, 100),
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Title.Should().Be("Corrected title");
        mocks.VerifyAssignmentSaved(Times.Once());
    }

    [Fact]
    public async Task UpdateAsync_MovesDeadlineIntoThePast_ReturnsFailure()
    {
        // Arrange — back-dating would retroactively lock out students who still had time to submit.
        var owner = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment(
            deadline: EntityBuilders.FutureDeadline, teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).UpdateAsync(
            assignment.Id,
            new UpdateAssignmentRequest("Same", "Body.", EntityBuilders.PastDeadline, 100),
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("future");
        mocks.VerifyAssignmentSaved(Times.Never());
    }

    [Fact]
    public async Task DeleteAsync_AssignmentHasSubmissions_ReturnsConflict()
    {
        // Arrange — assumption A5. Submissions cascade from the assignment, so deleting would destroy
        // graded student work rather than fail.
        var owner = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment(teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment).WithSubmissions(true),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).DeleteAsync(assignment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Conflict);
        mocks.Assignments.Verify(r => r.Remove(It.IsAny<Domain.Entities.Assignment>()), Times.Never());
    }

    [Fact]
    public async Task DeleteAsync_DraftWithNoSubmissions_ReturnsSuccess()
    {
        // Arrange
        var owner = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment(
            status: AssignmentStatus.Draft, teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment).WithSubmissions(false),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).DeleteAsync(assignment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        mocks.Assignments.Verify(r => r.Remove(assignment), Times.Once());
        mocks.VerifyAssignmentSaved(Times.Once());
    }

    // =============================================================================================
    // RULE 6 — drafts are invisible to students, visible to their own author
    // =============================================================================================

    [Fact]
    public async Task GetByIdAsync_StudentAndAssignmentIsDraft_ReturnsNotFound()
    {
        // Arrange — the student-scoped query returns null for a draft. visible: false models exactly
        // what the repository does.
        var student = EntityBuilders.Student();
        var draft = EntityBuilders.Assignment(status: AssignmentStatus.Draft);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(draft, student.Id, visible: false),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).GetByIdAsync(draft.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound, "403 would confirm the draft exists (A7)");

        // The student path must never fall back to the unscoped lookup, which would return the draft.
        mocks.Assignments.Verify(
            r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task GetByIdAsync_StudentAndAssignmentPublished_ReturnsIt()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var published = EntityBuilders.Assignment(status: AssignmentStatus.Published);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(published, student.Id),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).GetByIdAsync(published.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Id.Should().Be(published.Id);
        result.Value.Status.Should().Be(nameof(AssignmentStatus.Published));
    }

    [Fact]
    public async Task GetByIdAsync_TeacherOwnDraft_ReturnsIt()
    {
        // Arrange — rule 6 is about students. A teacher must see their own unpublished work.
        var owner = EntityBuilders.Teacher();
        var draft = EntityBuilders.Assignment(status: AssignmentStatus.Draft, teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(draft),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).GetByIdAsync(draft.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(nameof(AssignmentStatus.Draft));
    }

    [Fact]
    public async Task GetByIdAsync_TeacherAnotherTeachersAssignment_ReturnsNotFound()
    {
        // Arrange — the detail view matches the list view (own only), so the two cannot disagree about
        // what exists.
        var owner = EntityBuilders.Teacher("Owner", "owner@test.com");
        var nosyTeacher = EntityBuilders.Teacher("Nosy", "nosy@test.com");
        var assignment = EntityBuilders.Assignment(teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(assignment),
            CurrentUser = MockRepositoryHelper.CurrentUser(nosyTeacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).GetByIdAsync(assignment.Id, CancellationToken.None);

        // Assert
        result.ErrorType.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task PublishAsync_DraftBecomesPublished_AndIsIdempotent()
    {
        // Arrange
        var owner = EntityBuilders.Teacher();
        var draft = EntityBuilders.Assignment(status: AssignmentStatus.Draft, teacherId: owner.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsWith(draft),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(owner.Id, Role.Teacher)
        };
        var service = Build(mocks);

        // Act
        var first = await service.PublishAsync(draft.Id, CancellationToken.None);
        var second = await service.PublishAsync(draft.Id, CancellationToken.None);

        // Assert — a second publish is 200 with the same body, not a conflict. Correct PATCH semantics.
        first.IsSuccess.Should().BeTrue();
        first.Value.Status.Should().Be(nameof(AssignmentStatus.Published));
        second.IsSuccess.Should().BeTrue();
        second.Value.Status.Should().Be(nameof(AssignmentStatus.Published));
    }

    // =============================================================================================
    // RULE 3 — each role is routed to its own query, and no role can reach a wider one
    // =============================================================================================

    [Fact]
    public async Task GetPagedAsync_StudentRole_UsesStudentScopedQueryOnly()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var published = EntityBuilders.Assignment(status: AssignmentStatus.Published);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsEmpty().WithPage(published),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).GetPagedAsync(
            new AssignmentQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // The scoping is the assertion: a student's request must reach the enrolled-and-published
        // query and neither of the wider ones.
        mocks.Assignments.Verify(
            r => r.GetPagedForStudentAsync(
                student.Id, It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()),
            Times.Once());
        mocks.Assignments.Verify(
            r => r.GetPagedForTeacherAsync(
                It.IsAny<Guid>(), It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()),
            Times.Never());
        mocks.Assignments.Verify(
            r => r.GetPagedForAdminAsync(
                It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task GetPagedAsync_TeacherRole_UsesTeacherScopedQueryOnly()
    {
        // Arrange
        var teacher = EntityBuilders.Teacher();
        var own = EntityBuilders.Assignment(teacherId: teacher.Id);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsEmpty().WithPage(own),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).GetPagedAsync(
            new AssignmentQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        mocks.Assignments.Verify(
            r => r.GetPagedForTeacherAsync(
                teacher.Id, It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()),
            Times.Once());
        mocks.Assignments.Verify(
            r => r.GetPagedForAdminAsync(
                It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task GetPagedAsync_AdminRole_UsesUnscopedQuery()
    {
        // Arrange
        var admin = EntityBuilders.Admin();
        var any = EntityBuilders.Assignment();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsEmpty().WithPage(any),
            CurrentUser = MockRepositoryHelper.CurrentUser(admin.Id, Role.Admin)
        };

        // Act
        var result = await Build(mocks).GetPagedAsync(
            new AssignmentQueryParameters(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        mocks.Assignments.Verify(
            r => r.GetPagedForAdminAsync(
                It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(), It.IsAny<CancellationToken>()),
            Times.Once());
        mocks.Assignments.Verify(
            r => r.GetPagedForStudentAsync(
                It.IsAny<Guid>(), It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task GetPagedAsync_StudentForcesDraftFilter_StillScopedToPublished()
    {
        // Arrange — a filter can only narrow what the role already permits. Passing status=Draft must
        // not widen the student's query; it still goes through the published-only method.
        var student = EntityBuilders.Student();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsEmpty().WithPage(),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).GetPagedAsync(
            new AssignmentQueryParameters { Status = AssignmentStatus.Draft }, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Items.Should().BeEmpty();
        mocks.Assignments.Verify(
            r => r.GetPagedForStudentAsync(
                student.Id, It.IsAny<AssignmentFilter>(), It.IsAny<PaginationQuery>(),
                It.IsAny<CancellationToken>()),
            Times.Once());
    }

    [Fact]
    public async Task GetPagedAsync_PageSizeOverMaximum_ReturnsFailure()
    {
        // Arrange — docs/04 says reject, not silently clamp.
        var teacher = EntityBuilders.Teacher();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        // Act
        var result = await Build(mocks).GetPagedAsync(
            new AssignmentQueryParameters { PageSize = PaginationQuery.MaxPageSize + 1 },
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);
        result.Error.Should().Contain(PaginationQuery.MaxPageSize.ToString());
    }
}
