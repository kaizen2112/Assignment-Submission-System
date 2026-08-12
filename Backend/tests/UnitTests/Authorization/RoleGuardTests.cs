using System.Reflection;
using AssignmentSystem.Api.Controllers;
using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Assignment;
using AssignmentSystem.Application.DTOs.Common;
using AssignmentSystem.Application.DTOs.Submission;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace AssignmentSystem.UnitTests.Authorization;

// Rule 7: a wrong-role caller must get 403 and an anonymous one 401 — never an empty 200.
//
// Two halves, because the rule is enforced in two places:
//
// 1. The [Authorize] attributes on the controllers. ASP.NET turns those into the 401/403 itself, and
//    docs/06 says not to unit test the framework — so what these tests check is the *contract*: that
//    the attributes are present and name the right roles. That is the thing a careless edit deletes,
//    and the resulting hole is silent. The actual status codes were exercised over live HTTP in
//    Phase 3 (33 role/endpoint combinations).
//
// 2. The services' own checks, which do not trust the attributes. Those are executable here.
public sealed class RoleGuardTests
{
    private const string Admin = nameof(Role.Admin);
    private const string Teacher = nameof(Role.Teacher);
    private const string Student = nameof(Role.Student);

    // Returns the roles required to reach an action: its own [Authorize] if it has one, otherwise the
    // controller's. Null means the action is anonymous.
    private static string[]? RequiredRoles(MethodInfo action)
    {
        if (action.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
        {
            return null;
        }

        var onAction = action.GetCustomAttribute<AuthorizeAttribute>();
        var onController = action.DeclaringType!.GetCustomAttribute<AuthorizeAttribute>();

        var attribute = onAction ?? onController;
        if (attribute is null)
        {
            return [];
        }

        return string.IsNullOrWhiteSpace(attribute.Roles)
            ? []
            : attribute.Roles.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    }

    private static IEnumerable<MethodInfo> ActionsOf<TController>() =>
        typeof(TController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName);

    // =============================================================================================
    // TeacherRole_HitsAdminEndpoint_Returns403 — the attribute contract on AdminController
    // =============================================================================================

    [Fact]
    public void TeacherRole_HitsAdminEndpoint_Returns403()
    {
        // Every admin action must require the Admin role and nothing weaker. A Teacher or Student
        // presenting a valid token therefore fails the role check, which ASP.NET answers with 403.
        var actions = ActionsOf<AdminController>().ToList();

        actions.Should().NotBeEmpty("AdminController must expose actions for this test to mean anything");

        foreach (var action in actions)
        {
            var roles = RequiredRoles(action);

            roles.Should().NotBeNull($"{action.Name} must not be anonymous");
            roles.Should().Equal([Admin], $"{action.Name} must be reachable by Admin only");
        }
    }

    [Fact]
    public void AdminController_IsGuardedAtClassLevel()
    {
        // Class-level rather than per-action, so an endpoint added later is Admin-only by default
        // instead of open until someone remembers the attribute.
        var attribute = typeof(AdminController).GetCustomAttribute<AuthorizeAttribute>();

        attribute.Should().NotBeNull();
        attribute!.Roles.Should().Be(Admin);
    }

    [Fact]
    public void AdminController_CoversEveryEndpointInTheDocs()
        // docs/04 lists 13 admin endpoints — the original 11 plus the two class-roster reads added for
        // the admin UI. If one is added without a guard, the count check above still passes for the
        // others; this pins that the set itself is complete.
        => ActionsOf<AdminController>().Should().HaveCount(13);

    // =============================================================================================
    // StudentRole_HitsTeacherEndpoint_Returns403 — the attribute contract on the feature controllers
    // =============================================================================================

    [Theory]
    [InlineData(nameof(AssignmentsController.Create))]
    [InlineData(nameof(AssignmentsController.Update))]
    [InlineData(nameof(AssignmentsController.Publish))]
    [InlineData(nameof(AssignmentsController.Delete))]
    public void StudentRole_HitsTeacherEndpoint_Returns403(string actionName)
    {
        // Assignment mutations are Teacher-only, so a Student token fails the role check.
        var action = typeof(AssignmentsController).GetMethod(actionName)!;

        var roles = RequiredRoles(action);

        roles.Should().NotBeNull();
        roles.Should().Equal([Teacher], $"{actionName} must be Teacher-only");
        roles.Should().NotContain(Student);
    }

    [Theory]
    [InlineData(nameof(SubmissionsController.GetForAssignment))]
    [InlineData(nameof(SubmissionsController.Grade))]
    [InlineData(nameof(SubmissionsController.ChangeStatus))]
    public void StudentRole_HitsTeacherSubmissionEndpoint_Returns403(string actionName)
    {
        // Listing and grading submissions are the teacher's side of the API. A student hitting
        // /grade must be refused, not silently handed an empty result.
        var roles = RequiredRoles(typeof(SubmissionsController).GetMethod(actionName)!);

        roles.Should().Equal([Teacher], $"{actionName} must be Teacher-only");
    }

    [Theory]
    [InlineData(nameof(SubmissionsController.Submit))]
    [InlineData(nameof(SubmissionsController.GetMine))]
    [InlineData(nameof(SubmissionsController.UpdateMine))]
    public void TeacherRole_HitsStudentEndpoint_Returns403(string actionName)
    {
        // The mirror image: submitting an answer is Student-only, so a teacher cannot submit work.
        var roles = RequiredRoles(typeof(SubmissionsController).GetMethod(actionName)!);

        roles.Should().Equal([Student], $"{actionName} must be Student-only");
    }

    [Fact]
    public void AssignmentReads_AreOpenToTeacherAndStudentButNotAdmin()
    {
        // docs/04 scopes GET /assignments to Teacher and Student; the admin has /admin/assignments.
        foreach (var actionName in new[]
                 {
                     nameof(AssignmentsController.GetPaged),
                     nameof(AssignmentsController.GetById)
                 })
        {
            var roles = RequiredRoles(typeof(AssignmentsController).GetMethod(actionName)!);

            roles.Should().BeEquivalentTo([Teacher, Student], $"{actionName} is a shared read");
        }
    }

    // =============================================================================================
    // CommentsController — the role matrix, including the one action that deliberately has no Roles
    // =============================================================================================

    [Theory]
    [InlineData(nameof(CommentsController.Create))]
    [InlineData(nameof(CommentsController.Reply))]
    [InlineData(nameof(CommentsController.ToggleUpvote))]
    public void AdminRole_CannotPostComments(string actionName)
    {
        var roles = RequiredRoles(typeof(CommentsController).GetMethod(actionName)!);

        // A6: an admin observes coursework, they do not take part in it. Writing to a subject thread is
        // a participant's action, and an admin holds no teaching scope to moderate the result.
        roles.Should().BeEquivalentTo([Teacher, Student], $"{actionName} is for participants only");
    }

    [Fact]
    public void CommentsController_Read_IsOpenToAllThreeRoles()
    {
        var roles = RequiredRoles(typeof(CommentsController).GetMethod(nameof(CommentsController.GetForAssignment))!);

        // Admin included, because oversight means being able to read a thread. The service still scopes
        // it: a student sees threads only on published assignments in their own classes.
        roles.Should().BeEquivalentTo([Teacher, Student, Admin]);
    }

    [Fact]
    public void CommentsController_Delete_IsAuthenticatedButNotRoleScoped()
    {
        var roles = RequiredRoles(typeof(CommentsController).GetMethod(nameof(CommentsController.Delete))!);

        // The one endpoint in the system with no Roles, and it is intentional — do not "fix" it.
        // "The author, or the teacher who holds this class+subject" is not a role: a student may delete
        // their own comment but not a peer's, which no [Authorize(Roles)] can express. Empty here means
        // "authenticated, any role", and CommentService.DeleteAsync makes the actual decision — see
        // CommentServiceTests.DeleteAsync_OtherStudentComment_ReturnsFailure for the proof that it does.
        roles.Should().BeEmpty("author-or-owning-teacher is a data question, not a role question");

        // But it must still require a token. An empty array and a null are very different answers.
        roles.Should().NotBeNull();
    }

    // =============================================================================================
    // NoToken_HitsAnyEndpoint_Returns401 — nothing is anonymous except login and refresh
    // =============================================================================================

    [Fact]
    public void NoToken_HitsAnyEndpoint_Returns401()
    {
        // Every action across every controller must sit behind [Authorize]. Anything that does not would
        // answer an anonymous caller with data instead of 401.
        //
        // A new controller has to be added here by hand, which is the point: this list is the checklist,
        // and a controller missing from it is a controller nobody proved was guarded.
        var controllers = new[]
        {
            typeof(AuthController), typeof(AssignmentsController),
            typeof(SubmissionsController), typeof(AdminController),
            typeof(CommentsController)
        };

        var anonymous = new List<string>();

        foreach (var controller in controllers)
        {
            foreach (var action in controller
                         .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                         .Where(m => !m.IsSpecialName))
            {
                if (RequiredRoles(action) is null)
                {
                    anonymous.Add($"{controller.Name}.{action.Name}");
                }
            }
        }

        // Exactly two: a caller cannot present a token to obtain their first one, and refresh is
        // reached precisely when the access token has expired.
        anonymous.Should().BeEquivalentTo(
            ["AuthController.Login", "AuthController.Refresh"],
            "only login and refresh may be anonymous");
    }

    [Fact]
    public void EveryController_HasClassLevelAuthorize()
    {
        // Secure by default at the class level; individual actions opt out or narrow, never opt in.
        var controllers = new[]
        {
            typeof(AuthController), typeof(AssignmentsController),
            typeof(SubmissionsController), typeof(AdminController),
            typeof(CommentsController)
        };

        foreach (var controller in controllers)
        {
            controller.GetCustomAttribute<AuthorizeAttribute>()
                .Should().NotBeNull($"{controller.Name} must carry [Authorize] at class level");
        }
    }

    [Fact]
    public void EveryController_IsRoutedUnderApiV1()
        // Versioning from the start (docs/04). /health is a top-level minimal-API endpoint, not a
        // controller, so it is deliberately outside this check.
        => new[]
        {
            typeof(AuthController), typeof(AssignmentsController),
            typeof(SubmissionsController), typeof(AdminController)
        }
        .Select(c => c.GetCustomAttribute<RouteAttribute>()?.Template)
        .Should().OnlyContain(t => t != null && t.StartsWith("api/v1"));

    // =============================================================================================
    // The services do not trust the attributes — defense in depth, executable here
    // =============================================================================================

    [Fact]
    public async Task AssignmentService_AnonymousPrincipal_ReturnsUnauthorized()
    {
        // Arrange — a token that carried no usable sub claim. [Authorize] should have stopped this
        // already; the service is the second lock, not the first.
        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            CurrentUser = MockRepositoryHelper.AnonymousUser()
        };
        var service = new AssignmentService(
            mocks.Assignments.Object, mocks.Classes.Object, mocks.CurrentUser.Object);

        // Act
        var list = await service.GetPagedAsync(new AssignmentQueryParameters(), CancellationToken.None);
        var single = await service.GetByIdAsync(Guid.NewGuid(), CancellationToken.None);
        var create = await service.CreateAsync(
            new CreateAssignmentRequest("T", "D", EntityBuilders.FutureDeadline, 10, Guid.NewGuid(), Guid.NewGuid()),
            CancellationToken.None);
        var update = await service.UpdateAsync(
            Guid.NewGuid(),
            new UpdateAssignmentRequest("T", "D", EntityBuilders.FutureDeadline, 10),
            CancellationToken.None);
        var publish = await service.PublishAsync(Guid.NewGuid(), CancellationToken.None);
        var delete = await service.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        // Assert
        new[]
        {
            list.ErrorType, single.ErrorType, create.ErrorType,
            update.ErrorType, publish.ErrorType, delete.ErrorType
        }
        .Should().AllBeEquivalentTo(ErrorType.Unauthorized);

        mocks.VerifyAssignmentSaved(Times.Never());
    }

    [Fact]
    public async Task SubmissionService_AnonymousPrincipal_ReturnsUnauthorized()
    {
        // Arrange
        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            CurrentUser = MockRepositoryHelper.AnonymousUser()
        };
        var service = new SubmissionService(
            mocks.Submissions.Object, mocks.Assignments.Object, mocks.Classes.Object,
            mocks.Users.Object, mocks.CurrentUser.Object);

        // Act
        var submit = await service.SubmitAsync(
            Guid.NewGuid(), new SubmitAnswerRequest("Answer."), CancellationToken.None);
        var mine = await service.GetMineAsync(Guid.NewGuid(), CancellationToken.None);
        var update = await service.UpdateMineAsync(
            Guid.NewGuid(), new SubmitAnswerRequest("Answer."), CancellationToken.None);
        var grade = await service.GradeAsync(
            Guid.NewGuid(), Guid.NewGuid(), new GradeSubmissionRequest(1, null), CancellationToken.None);
        var status = await service.ChangeStatusAsync(
            Guid.NewGuid(), Guid.NewGuid(),
            new ChangeSubmissionStatusRequest(nameof(SubmissionStatus.Graded)), CancellationToken.None);
        var list = await service.GetPagedForAssignmentAsync(
            Guid.NewGuid(), new PagedQueryParameters(), CancellationToken.None);

        // Assert
        new[]
        {
            submit.ErrorType, mine.ErrorType, update.ErrorType,
            grade.ErrorType, status.ErrorType, list.ErrorType
        }
        .Should().AllBeEquivalentTo(ErrorType.Unauthorized);

        mocks.VerifySubmissionSaved(Times.Never());
    }

    [Fact]
    public async Task SubmissionService_TeacherWithoutTheClass_CannotGrade()
    {
        // Arrange — rule 4 as the service's own guard, independent of any attribute.
        var teacher = EntityBuilders.Teacher();
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var submission = EntityBuilders.Submission(assignment, student.Id, student: student);

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Submissions = MockRepositoryHelper.SubmissionsWith(submission),
            Classes = MockRepositoryHelper.Classes(isAssigned: false),
            CurrentUser = MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher)
        };
        var service = new SubmissionService(
            mocks.Submissions.Object, mocks.Assignments.Object, mocks.Classes.Object,
            mocks.Users.Object, mocks.CurrentUser.Object);

        // Act
        var result = await service.GradeAsync(
            assignment.Id, submission.Id, new GradeSubmissionRequest(10, null), CancellationToken.None);

        // Assert
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        mocks.VerifySubmissionSaved(Times.Never());
    }
}
