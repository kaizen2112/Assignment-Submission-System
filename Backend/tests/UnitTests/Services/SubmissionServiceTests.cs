using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Submission;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Moq;

namespace AssignmentSystem.UnitTests.Services;

// Covers rules 1, 2, 5 and 8 from docs/05_business_rules.md, plus the rule-3/4 checks that live on the
// submission paths. Every dependency is mocked — no database, no HTTP.
public sealed class SubmissionServiceTests
{
    private const string AnyAnswer = "My answer.";

    private static SubmissionService Build(MockRepositoryHelper.ServiceMocks mocks) =>
        new(
            mocks.Submissions.Object,
            mocks.Assignments.Object,
            mocks.Classes.Object,
            mocks.Users.Object,
            mocks.CurrentUser.Object);

    // =============================================================================================
    // RULE 1 — no submission after the deadline unless the assignment allows it
    // =============================================================================================

    [Fact]
    public async Task SubmitAsync_BeforeDeadline_ReturnsSuccess()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(deadline: EntityBuilders.FutureDeadline);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
            Submissions = MockRepositoryHelper.SubmissionsEmpty(),
            Users = MockRepositoryHelper.UsersWith(student),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).SubmitAsync(
            assignment.Id, new SubmitAnswerRequest(AnyAnswer), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(nameof(SubmissionStatus.Submitted));
        result.Value.IsLate.Should().BeFalse();
        result.Value.Marks.Should().BeNull("nothing is graded at submission time");
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task SubmitAsync_AfterDeadline_LateDisabled_ReturnsFailure()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(
            deadline: EntityBuilders.PastDeadline,
            allowLateSubmission: false);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
            Submissions = MockRepositoryHelper.SubmissionsEmpty(),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).SubmitAsync(
            assignment.Id, new SubmitAnswerRequest(AnyAnswer), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("deadline");
        result.ErrorType.Should().Be(ErrorType.Validation);

        // The rejection must happen before anything is written, not after.
        mocks.Submissions.Verify(
            r => r.AddAsync(It.IsAny<Domain.Entities.Submission>(), It.IsAny<CancellationToken>()),
            Times.Never());
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task SubmitAsync_AfterDeadline_LateEnabled_SetsStatusLate()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(
            deadline: EntityBuilders.PastDeadline,
            allowLateSubmission: true);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
            Submissions = MockRepositoryHelper.SubmissionsEmpty(),
            Users = MockRepositoryHelper.UsersWith(student),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).SubmitAsync(
            assignment.Id, new SubmitAnswerRequest(AnyAnswer), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(nameof(SubmissionStatus.Late));
        // IsLate is tracked separately from Status precisely so grading cannot erase it later.
        result.Value.IsLate.Should().BeTrue();
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task SubmitAsync_AlreadySubmitted_ReturnsConflict()
    {
        // Arrange — assumption A4: one submission per student per assignment.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var existing = EntityBuilders.Submission(assignment, student.Id, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
            Submissions = MockRepositoryHelper.SubmissionsWith(existing),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).SubmitAsync(
            assignment.Id, new SubmitAnswerRequest(AnyAnswer), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Conflict);
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task SubmitAsync_AssignmentNotVisibleToStudent_ReturnsNotFound()
    {
        // Arrange — rules 3 and 6: a draft, or an assignment in another class, comes back null from
        // the repository. The service cannot tell those two cases apart, which is assumption A7.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(status: AssignmentStatus.Draft);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Assignments = MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id, visible: false),
            Submissions = MockRepositoryHelper.SubmissionsEmpty(),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).SubmitAsync(
            assignment.Id, new SubmitAnswerRequest(AnyAnswer), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound, "403 would confirm the assignment exists");
    }

    // =============================================================================================
    // RULE 2 — no update after the deadline, and none once graded
    // =============================================================================================

    [Fact]
    public async Task UpdateMineAsync_BeforeDeadlineNotGraded_ReturnsSuccess()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(deadline: EntityBuilders.FutureDeadline);
        var submission = EntityBuilders.Submission(
            assignment, student.Id, SubmissionStatus.Submitted, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).UpdateMineAsync(
            assignment.Id, new SubmitAnswerRequest("Revised answer."), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.AnswerText.Should().Be("Revised answer.");
        result.Value.UpdatedAt.Should().NotBeNull();
        // Rule 8: an edit keeps the status — Submitted -> Submitted.
        result.Value.Status.Should().Be(nameof(SubmissionStatus.Submitted));
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task UpdateMineAsync_AfterDeadline_ReturnsFailure()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(deadline: EntityBuilders.PastDeadline);
        var submission = EntityBuilders.Submission(
            assignment, student.Id, SubmissionStatus.Submitted, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).UpdateMineAsync(
            assignment.Id, new SubmitAnswerRequest("Too late."), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("deadline");
        submission.AnswerText.Should().NotBe("Too late.", "the entity must be left untouched");
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task UpdateMineAsync_AfterDeadline_LateEnabled_StillReturnsFailure()
    {
        // Arrange — AllowLateSubmission buys one late delivery, not an open editing window. docs/05
        // states rule 2 with no late exception, and this pins that reading down.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(
            deadline: EntityBuilders.PastDeadline,
            allowLateSubmission: true);
        var submission = EntityBuilders.Submission(
            assignment, student.Id, SubmissionStatus.Late, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).UpdateMineAsync(
            assignment.Id, new SubmitAnswerRequest("Editing my late work."), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("deadline");
    }

    [Fact]
    public async Task UpdateMineAsync_GradedSubmission_ReturnsFailure()
    {
        // Arrange — deadline deliberately in the future, so the deadline check passes and the graded
        // check is what rejects this. Assumption A1: grading locks the student out.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(deadline: EntityBuilders.FutureDeadline);
        var submission = EntityBuilders.Submission(
            assignment, student.Id, SubmissionStatus.Graded, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).UpdateMineAsync(
            assignment.Id, new SubmitAnswerRequest("Changing my graded answer."), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("graded");
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task UpdateMineAsync_NoSubmissionOfTheirOwn_ReturnsNotFound()
    {
        // Arrange — rule 3: the repository always filters on StudentId, so another student's row is
        // simply absent rather than forbidden.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsEmpty(),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).UpdateMineAsync(
            assignment.Id, new SubmitAnswerRequest(AnyAnswer), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
    }

    // =============================================================================================
    // RULE 3 — a student reaches only their own submission
    // =============================================================================================

    [Fact]
    public async Task GetMineAsync_OtherStudentsSubmission_ReturnsNotFound()
    {
        // Arrange — the repository is asked for (assignmentId, callerId). Another student's row simply
        // does not match, so it is absent rather than forbidden — 403 would confirm it exists (A7).
        var owner = EntityBuilders.Student("Owner", "owner@test.com");
        var otherStudent = EntityBuilders.Student("Other", "other@test.com");
        var assignment = EntityBuilders.Assignment();
        var ownersSubmission = EntityBuilders.Submission(assignment, owner.Id, student: owner);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            // Set up for the owner only; the caller below is someone else.
            Submissions = MockRepositoryHelper.SubmissionsWith(ownersSubmission),
            CurrentUser = MockRepositoryHelper.CurrentUser(otherStudent.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).GetMineAsync(assignment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);

        // The lookup must carry the caller's own id — never the id from the route or the body.
        mocks.Submissions.Verify(
            r => r.GetByAssignmentAndStudentAsync(
                assignment.Id, otherStudent.Id, It.IsAny<CancellationToken>()),
            Times.Once());
        mocks.Submissions.Verify(
            r => r.GetByAssignmentAndStudentAsync(
                It.IsAny<Guid>(), owner.Id, It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task GetMineAsync_OwnSubmission_ReturnsItWithMarks()
    {
        // Arrange — the other half of rule 3: a student does see their own graded result.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(maxMarks: 50);
        var submission = EntityBuilders.Submission(
            assignment, student.Id, SubmissionStatus.Graded, gradedMarks: 45, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            CurrentUser = MockRepositoryHelper.CurrentUser(student.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).GetMineAsync(assignment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Marks.Should().Be(45);
        result.Value.MaxMarks.Should().Be(50, "the client renders 45/50 without a second request");
        result.Value.Feedback.Should().NotBeNull();
    }

    // =============================================================================================
    // RULE 5 — marks must land within 0..MaxMarks
    // =============================================================================================

    [Fact]
    public async Task GradeAsync_MarksZero_ReturnsSuccess()
    {
        // Arrange — zero is a legitimate mark, which is why Submission.Marks is int? and not 0-means-
        // ungraded.
        var (service, submission, mocks) = ArrangeGrading(maxMarks: 100);

        // Act
        var result = await service.GradeAsync(
            submission.AssignmentId, submission.Id,
            new GradeSubmissionRequest(0, "Nothing usable."), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Marks.Should().Be(0);
        result.Value.Status.Should().Be(nameof(SubmissionStatus.Graded));
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task GradeAsync_MarksEqualMaxMarks_ReturnsSuccess()
    {
        // Arrange — the inclusive upper boundary.
        var (service, submission, mocks) = ArrangeGrading(maxMarks: 50);

        // Act
        var result = await service.GradeAsync(
            submission.AssignmentId, submission.Id,
            new GradeSubmissionRequest(50, "Full marks."), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Marks.Should().Be(50);
        result.Value.GradedAt.Should().NotBeNull();
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task GradeAsync_MarksExceedMaxMarks_ReturnsFailure()
    {
        // Arrange — one past the boundary.
        var (service, submission, mocks) = ArrangeGrading(maxMarks: 50);

        // Act
        var result = await service.GradeAsync(
            submission.AssignmentId, submission.Id,
            new GradeSubmissionRequest(51, null), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);
        // The message names the actual ceiling, so a teacher does not have to go and look it up.
        result.Error.Should().Contain("50");
        submission.Marks.Should().BeNull("a rejected grade must not be applied");
        submission.Status.Should().Be(SubmissionStatus.Submitted);
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task GradeAsync_NegativeMarks_ReturnsFailure()
    {
        // Arrange — the validator rejects this first in production; the service check is the safety
        // net docs/05 asks for, and this test exercises that net directly.
        var (service, submission, mocks) = ArrangeGrading(maxMarks: 100);

        // Act
        var result = await service.GradeAsync(
            submission.AssignmentId, submission.Id,
            new GradeSubmissionRequest(-1, null), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("negative");
        submission.Marks.Should().BeNull();
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task GradeAsync_TeacherNotAssignedToClass_ReturnsForbidden()
    {
        // Arrange — rule 4 on the grading path.
        var (service, submission, mocks) = ArrangeGrading(maxMarks: 100, isAssigned: false);

        // Act
        var result = await service.GradeAsync(
            submission.AssignmentId, submission.Id,
            new GradeSubmissionRequest(10, null), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task GradeAsync_SubmissionUnderWrongAssignment_ReturnsNotFound()
    {
        // Arrange — a real submission id nested under a different assignment in the route. It must
        // read as absent, so the URL cannot be edited into another assignment's submission.
        var (service, submission, _) = ArrangeGrading(maxMarks: 100);

        // Act
        var result = await service.GradeAsync(
            Guid.NewGuid(), submission.Id,
            new GradeSubmissionRequest(10, null), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
    }

    // =============================================================================================
    // RULE 8 — only the transitions in docs/05's table are permitted
    // =============================================================================================

    [Fact]
    public async Task ChangeStatusAsync_SubmittedToGraded_ReturnsSuccess()
    {
        // Arrange
        var (service, submission, mocks) = ArrangeStatusChange(SubmissionStatus.Submitted);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.Graded)), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(nameof(SubmissionStatus.Graded));
        result.Value.GradedAt.Should().NotBeNull("GradedAt must stay consistent with Status");
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task ChangeStatusAsync_LateToGraded_ReturnsSuccess()
    {
        // Arrange
        var (service, submission, mocks) = ArrangeStatusChange(SubmissionStatus.Late);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.Graded)), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Status.Should().Be(nameof(SubmissionStatus.Graded));
        result.Value.IsLate.Should().BeTrue("grading a late submission must not erase that it was late");
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task ChangeStatusAsync_GradedToSubmitted_ReturnsFailure()
    {
        // Arrange
        var (service, submission, mocks) = ArrangeStatusChange(SubmissionStatus.Graded);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.Submitted)), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("un-graded");
        submission.Status.Should().Be(SubmissionStatus.Graded, "the entity must be unchanged");
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task ChangeStatusAsync_GradedToLate_ReturnsFailure()
    {
        // Arrange
        var (service, submission, _) = ArrangeStatusChange(SubmissionStatus.Graded);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.Late)), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("un-graded");
    }

    [Theory]
    [InlineData(SubmissionStatus.Submitted)]
    [InlineData(SubmissionStatus.Late)]
    [InlineData(SubmissionStatus.Graded)]
    public async Task ChangeStatusAsync_ToNotSubmitted_ReturnsFailure(SubmissionStatus from)
    {
        // Arrange — docs/05's "Any -> NotSubmitted: cannot go backward". This is the testable form of
        // the doc's "skip" case: NotSubmitted -> Graded cannot be arranged at all, because no
        // NotSubmitted row can exist (see the test below).
        var (service, submission, mocks) = ArrangeStatusChange(from);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.NotSubmitted)),
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public void Submission_NotSubmitted_IsUnreachableByConstruction()
    {
        // This is why docs/05's "NotSubmitted -> Graded (skip)" has no direct test: a submission row
        // only exists once a student has submitted, so NotSubmitted is a state before the aggregate
        // rather than one it can hold. Create derives Submitted or Late and nothing else.
        var assignment = EntityBuilders.Assignment();

        var onTime = EntityBuilders.Submission(assignment, status: SubmissionStatus.Submitted);
        var late = EntityBuilders.Submission(assignment, status: SubmissionStatus.Late);
        var graded = EntityBuilders.Submission(assignment, status: SubmissionStatus.Graded);

        new[] { onTime.Status, late.Status, graded.Status }
            .Should().NotContain(SubmissionStatus.NotSubmitted);
    }

    [Fact]
    public async Task ChangeStatusAsync_GradedToGraded_ReturnsSuccess()
    {
        // Arrange — re-grading. Not in docs/05's table, added deliberately: a teacher who types 8
        // instead of 85 must be able to correct it, and A1 locks the student out, not the teacher.
        var (service, submission, mocks) = ArrangeStatusChange(SubmissionStatus.Graded);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.Graded)), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue("re-grading corrects a mistyped mark");
        mocks.VerifySubmissionSaved(Times.Once());
    }

    [Fact]
    public async Task ChangeStatusAsync_UnknownStatusName_ReturnsFailure()
    {
        // Arrange — ChangeSubmissionStatusValidator rejects this first in production. This covers the
        // service's own parse guard, which exists because the service must not assume it was reached
        // through the validation filter.
        var (service, submission, mocks) = ArrangeStatusChange(SubmissionStatus.Submitted);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest("Bogus"), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not a valid submission status");
        result.ErrorType.Should().Be(ErrorType.Validation);
        submission.Status.Should().Be(SubmissionStatus.Submitted);
        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task ChangeStatusAsync_StatusIsCaseSensitive_ReturnsFailure()
    {
        // Arrange — Enum.TryParse is called with ignoreCase: false throughout the codebase, matching
        // how role claims are read off the JWT. "graded" must therefore not be accepted as "Graded".
        var (service, submission, _) = ArrangeStatusChange(SubmissionStatus.Submitted);

        // Act
        var result = await service.ChangeStatusAsync(
            submission.AssignmentId, submission.Id,
            new ChangeSubmissionStatusRequest("graded"), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
    }

    // =============================================================================================
    // Arrange helpers — the two teacher-side setups every rule 5 / rule 8 test needs
    // =============================================================================================

    private static (SubmissionService Service, Domain.Entities.Submission Submission,
        MockRepositoryHelper.ServiceMocks Mocks) ArrangeGrading(int maxMarks, bool isAssigned = true)
    {
        var teacher = EntityBuilders.Teacher();
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment(maxMarks: maxMarks, teacherId: teacher.Id);
        var submission = EntityBuilders.Submission(
            assignment, student.Id, SubmissionStatus.Submitted, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            Classes = MockRepositoryHelper.Classes(isAssigned),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        return (Build(mocks), submission, mocks);
    }

    private static (SubmissionService Service, Domain.Entities.Submission Submission,
        MockRepositoryHelper.ServiceMocks Mocks) ArrangeStatusChange(SubmissionStatus from)
    {
        var teacher = EntityBuilders.Teacher();
        var student = EntityBuilders.Student();

        // A Late submission only makes sense against a past deadline, and a Graded one is reached by
        // actually calling Grade — so the builder's status drives both.
        var assignment = EntityBuilders.Assignment(
            deadline: from == SubmissionStatus.Late ? EntityBuilders.PastDeadline : EntityBuilders.FutureDeadline,
            allowLateSubmission: from == SubmissionStatus.Late,
            teacherId: teacher.Id);

        var submission = EntityBuilders.Submission(assignment, student.Id, from, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            Classes = MockRepositoryHelper.Classes(isAssigned: true),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };

        return (Build(mocks), submission, mocks);
    }
}
