using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Comment;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Moq;

namespace AssignmentSystem.UnitTests.Services;

// The comment feature's own rules, plus the proof that it reuses the existing scoping rather than
// working around it: rule 3 (enrolment), rule 4 (teacher class+subject) and rule 6 (drafts invisible)
// all have to hold on a comment thread exactly as they do on the assignment it hangs off.
//
// Every dependency is mocked — no database, no HTTP. Note the limit that implies, and it is the same one
// the rest of this suite has: these tests prove the service *asks* the right scoped query, not that the
// query's SQL filters correctly. GetPublishedForStudentAsync returning null is what a draft looks like
// to this service, so a draft is modelled by arranging that null.
public sealed class CommentServiceTests
{
    private const string AnyContent = "Any comment.";

    private static CommentService Build(
        Mock<ICommentRepository> comments,
        Mock<IAssignmentRepository> assignments,
        Mock<IClassRepository> classes,
        Mock<IUserRepository> users,
        Mock<ICurrentUserService> currentUser) =>
        new(comments.Object, assignments.Object, classes.Object, users.Object, currentUser.Object);

    // =============================================================================================
    // RULE 3 — a student who is not enrolled in the class has no thread to post to
    // =============================================================================================

    [Fact]
    public async Task AddAsync_StudentNotEnrolled_ReturnsFailure()
    {
        // Arrange — visible: false is how the repository reports "published, but not for you": the
        // enrolment filter is inside the query, so an unenrolled student gets null back.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();

        var comments = CommentMocks.Comments();

        // Act
        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id, visible: false),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddAsync(assignment.Id, new CreateCommentRequest(AnyContent), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();

        // 404, not 403 (assumption A7): a 403 would confirm the assignment exists.
        result.ErrorType.Should().Be(ErrorType.NotFound);

        // The comment must not have been written. A service that returned a failure *after* inserting
        // would still show a failure here, so the absence of the write is asserted separately.
        comments.Verify(
            r => r.AddAsync(It.IsAny<Domain.Entities.Comment>(), It.IsAny<CancellationToken>()),
            Times.Never());
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    // =============================================================================================
    // RULE 6 — a draft assignment has no thread as far as a student is concerned
    // =============================================================================================

    [Fact]
    public async Task AddAsync_DraftAssignment_ReturnsFailure()
    {
        // Arrange — a Draft assignment. The student read path filters on Published inside the query, so
        // like the unenrolled case it surfaces as null; A7 makes both indistinguishable on purpose.
        var student = EntityBuilders.Student();
        var draft = EntityBuilders.Assignment(status: AssignmentStatus.Draft);

        var comments = CommentMocks.Comments();

        // Act
        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(draft, student.Id, visible: false),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddAsync(draft.Id, new CreateCommentRequest(AnyContent), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task AddAsync_EnrolledStudentOnPublishedAssignment_ReturnsSuccess()
    {
        // The positive counterpart to the two above. Without it, a service that rejected *everything*
        // would pass both rule-3 and rule-6 tests.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();

        var comments = CommentMocks.Comments();

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddAsync(assignment.Id, new CreateCommentRequest("  Trim me.  "), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Content.Should().Be("Trim me.", "content is trimmed before it is stored");
        result.Value.AuthorName.Should().Be(student.FullName);
        result.Value.UpvoteCount.Should().Be(0);
        result.Value.HasUpvoted.Should().BeFalse();
        result.Value.Replies.Should().BeEmpty();
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once());
    }

    // =============================================================================================
    // RULE 4 — a teacher without the class+subject grant cannot reach the thread either
    // =============================================================================================

    [Fact]
    public async Task AddAsync_TeacherNotAssignedToClassSubject_ReturnsForbidden()
    {
        var teacher = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment();

        var comments = CommentMocks.Comments();

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsWith(assignment),
                MockRepositoryHelper.Classes(isAssigned: false),
                MockRepositoryHelper.UsersWith(teacher),
                MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher))
            .AddAsync(assignment.Id, new CreateCommentRequest(AnyContent), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();

        // Forbidden rather than NotFound, unlike the student cases. The teacher already knows the
        // assignment exists — they can see it in listings — so there is nothing left to conceal, and
        // this matches how SubmissionService answers the same situation.
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    // =============================================================================================
    // DELETE — the author, or the teacher who holds the class+subject
    // =============================================================================================

    [Fact]
    public async Task DeleteAsync_OwnComment_ReturnsSuccess()
    {
        // Arrange
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var comment = CommentMocks.Comment(assignment.Id, student);

        var comments = CommentMocks.CommentsWith(comment);

        // Act
        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .DeleteAsync(assignment.Id, comment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Soft, not hard: the row survives so any replies stay reachable.
        comment.IsDeleted.Should().BeTrue();
        comment.Content.Should().Be(
            "Test comment.", "the text is kept; the read path is what withholds it");

        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once());
    }

    [Fact]
    public async Task DeleteAsync_OtherStudentComment_ReturnsFailure()
    {
        // Arrange — two students in the same class. The caller can see the thread, which is exactly why
        // this test matters: visibility is not permission to moderate.
        var author = EntityBuilders.Student("Comment Author", "author@test.com");
        var otherStudent = EntityBuilders.Student("Other Student", "other@test.com");
        var assignment = EntityBuilders.Assignment();
        var comment = CommentMocks.Comment(assignment.Id, author);

        var comments = CommentMocks.CommentsWith(comment);

        // Act
        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, otherStudent.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(otherStudent),
                MockRepositoryHelper.CurrentUser(otherStudent.Id, Role.Student))
            .DeleteAsync(assignment.Id, comment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Forbidden);

        // The entity must be untouched — a service that flagged it and *then* returned a failure would
        // still look correct on the Result alone.
        comment.IsDeleted.Should().BeFalse();
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task DeleteAsync_TeacherDeletesAnyComment_ReturnsSuccess()
    {
        // Arrange — a student's comment, deleted by the teacher who holds the class+subject. This is the
        // moderation path: the teacher is not the author, and that is the point.
        var student = EntityBuilders.Student();
        var teacher = EntityBuilders.Teacher();
        var assignment = EntityBuilders.Assignment();
        var comment = CommentMocks.Comment(assignment.Id, student);

        var comments = CommentMocks.CommentsWith(comment);

        // Act
        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsWith(assignment),
                MockRepositoryHelper.Classes(isAssigned: true),
                MockRepositoryHelper.UsersWith(teacher),
                MockRepositoryHelper.CurrentUser(teacher.Id, Role.Teacher))
            .DeleteAsync(assignment.Id, comment.Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        comment.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_TeacherWithoutGrant_ReturnsForbidden()
    {
        // The moderation power is not "any teacher" — it is the teacher of that class and subject.
        // Without this, a service that let every Teacher delete anything would pass the test above.
        var student = EntityBuilders.Student();
        var otherTeacher = EntityBuilders.Teacher("Other Teacher", "other.teacher@test.com");
        var assignment = EntityBuilders.Assignment();
        var comment = CommentMocks.Comment(assignment.Id, student);

        var comments = CommentMocks.CommentsWith(comment);

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsWith(assignment),
                MockRepositoryHelper.Classes(isAssigned: false),
                MockRepositoryHelper.UsersWith(otherTeacher),
                MockRepositoryHelper.CurrentUser(otherTeacher.Id, Role.Teacher))
            .DeleteAsync(assignment.Id, comment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Forbidden);
        comment.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_CommentFromAnotherAssignment_ReturnsNotFound()
    {
        // URL tampering: a real comment id nested under an assignment it does not belong to. Without the
        // AssignmentId comparison, the route's assignment would be authorized while a comment from a
        // different one got deleted.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var elsewhere = EntityBuilders.Assignment(title: "Another assignment");
        var comment = CommentMocks.Comment(elsewhere.Id, student);

        var comments = CommentMocks.CommentsWith(comment);

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .DeleteAsync(assignment.Id, comment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
        comment.IsDeleted.Should().BeFalse();
    }

    // =============================================================================================
    // UPVOTE — the row's existence is the vote, so voting twice withdraws it
    // =============================================================================================

    [Fact]
    public async Task ToggleUpvote_Twice_RemovesUpvote()
    {
        // Arrange — the upvote mock is stateful (see CommentMocks.WithStatefulUpvotes), so the second
        // call genuinely observes the first one's effect. Against a canned return value this test would
        // pass no matter what the service did.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var comment = CommentMocks.Comment(assignment.Id, student);

        var comments = CommentMocks.CommentsWith(comment).WithStatefulUpvotes();

        var service = Build(
            comments,
            MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
            MockRepositoryHelper.Classes(),
            MockRepositoryHelper.UsersWith(student),
            MockRepositoryHelper.CurrentUser(student.Id, Role.Student));

        // Act — vote, then vote again.
        var first = await service.ToggleUpvoteAsync(assignment.Id, comment.Id, CancellationToken.None);
        var second = await service.ToggleUpvoteAsync(assignment.Id, comment.Id, CancellationToken.None);

        // Assert
        first.IsSuccess.Should().BeTrue();
        first.Value.HasUpvoted.Should().BeTrue();
        first.Value.UpvoteCount.Should().Be(1);

        second.IsSuccess.Should().BeTrue();
        second.Value.HasUpvoted.Should().BeFalse("a second vote withdraws the first");
        second.Value.UpvoteCount.Should().Be(0);
    }

    [Fact]
    public async Task ToggleUpvote_DeletedComment_ReturnsFailure()
    {
        // A deleted comment is a tombstone that exists only to keep its replies reachable. Voting on it
        // would attach a count to text nobody can read.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var comment = CommentMocks.Comment(assignment.Id, student, deleted: true);

        var comments = CommentMocks.CommentsWith(comment).WithStatefulUpvotes();

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .ToggleUpvoteAsync(assignment.Id, comment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        comments.Verify(
            r => r.ToggleUpvoteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    // =============================================================================================
    // REPLIES — flattened onto the root, addressed with a mention, and scoped to this assignment
    // =============================================================================================

    [Fact]
    public async Task AddReplyAsync_ToReply_AttachesToRootAndRecordsAddressee()
    {
        // The two-level invariant, which is now maintained by *normalising* rather than by refusing.
        // Replying to a reply is allowed; what it must not do is create a third level. So the row lands
        // under the same top-level comment, with ReplyToCommentId naming who it answers — and the depth of
        // the stored tree is unchanged no matter how long the conversation runs.
        var student = EntityBuilders.Student();
        var other = EntityBuilders.Student("Nadia Islam", "nadia@test.com");
        var assignment = EntityBuilders.Assignment();
        var root = CommentMocks.Comment(assignment.Id, student, "Top level.");
        var reply = CommentMocks.Comment(assignment.Id, other, "First reply.", parentCommentId: root.Id);

        var comments = CommentMocks.CommentsWith(root, reply);

        // The entity handed to the repository is captured, because the assertion that matters is about
        // what gets *persisted* — a service that returned the right DTO while storing ParentCommentId =
        // reply.Id would pass every assertion made on the response alone, and would silently be three
        // levels deep in the database.
        Domain.Entities.Comment? saved = null;
        comments
            .Setup(r => r.AddAsync(It.IsAny<Domain.Entities.Comment>(), It.IsAny<CancellationToken>()))
            .Callback((Domain.Entities.Comment c, CancellationToken _) => saved = c);

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student, other),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddReplyAsync(
                assignment.Id, reply.Id, new CreateCommentRequest("Answering you."),
                CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        saved.Should().NotBeNull();

        // Attached to the root, NOT to the reply that was answered — this is the flattening.
        saved!.ParentCommentId.Should().Be(root.Id);

        // ...and the reply it answered is recorded, which is the information the missing indent carried.
        saved.ReplyToCommentId.Should().Be(reply.Id);

        // The response carries the addressee's name so an optimistic client can render the @mention on the
        // row it just posted, rather than having it appear from nowhere on the next read.
        result.Value.ReplyToCommentId.Should().Be(reply.Id);
        result.Value.ReplyToAuthorName.Should().Be("Nadia Islam");

        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once());
    }

    [Fact]
    public async Task AddReplyAsync_ToLiveReplyUnderDeletedRoot_ReturnsSuccess()
    {
        // The deleted check is on the comment being answered, not on the root above it. A thread whose
        // opening comment was deleted is still a live conversation — the tombstone is returned by the read
        // precisely so it stays reachable — so answering someone inside it has to work.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var deletedRoot = CommentMocks.Comment(assignment.Id, student, "Regrettable.", deleted: true);
        var liveReply = CommentMocks.Comment(
            assignment.Id, student, "Still here.", parentCommentId: deletedRoot.Id);

        var comments = CommentMocks.CommentsWith(deletedRoot, liveReply);

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddReplyAsync(
                assignment.Id, liveReply.Id, new CreateCommentRequest(AnyContent), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.ReplyToCommentId.Should().Be(liveReply.Id);
    }

    [Fact]
    public async Task AddReplyAsync_ParentInAnotherAssignment_ReturnsNotFound()
    {
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var elsewhere = EntityBuilders.Assignment(title: "Another assignment");
        var foreignParent = CommentMocks.Comment(elsewhere.Id, student);

        var comments = CommentMocks.CommentsWith(foreignParent);

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddReplyAsync(
                assignment.Id, foreignParent.Id, new CreateCommentRequest(AnyContent),
                CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.NotFound);
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task AddReplyAsync_ToTopLevelComment_ReturnsSuccess()
    {
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var parent = CommentMocks.Comment(assignment.Id, student);

        var comments = CommentMocks.CommentsWith(parent);

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddReplyAsync(
                assignment.Id, parent.Id, new CreateCommentRequest("A reply."), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Content.Should().Be("A reply.");

        // No addressee recorded. A reply to a top-level comment already sits directly under the person it
        // answers, so a mention would only restate its position — and once every reply carries one, the
        // mention stops meaning "this answers someone other than the obvious person".
        result.Value.ReplyToCommentId.Should().BeNull();
        result.Value.ReplyToAuthorName.Should().BeNull();

        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once());
    }

    // =============================================================================================
    // READ — the tree, and what a deleted comment discloses
    // =============================================================================================

    [Fact]
    public async Task GetForAssignmentAsync_NestsRepliesUnderTheirParent()
    {
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var parent = CommentMocks.Comment(assignment.Id, student, "Top level.");
        var replyOne = CommentMocks.Comment(assignment.Id, student, "First.", parent.Id);
        var replyTwo = CommentMocks.Comment(assignment.Id, student, "Second.", parent.Id);
        var lone = CommentMocks.Comment(assignment.Id, student, "No replies.");

        var comments = CommentMocks.Comments().WithThread(
            CommentMocks.Row(parent, upvoteCount: 3, hasUpvoted: true),
            CommentMocks.Row(replyOne),
            CommentMocks.Row(replyTwo),
            CommentMocks.Row(lone));

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .GetForAssignmentAsync(assignment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        // Only top-level comments appear at the root — replies must not be doubled up there.
        result.Value.Should().HaveCount(2);

        var top = result.Value.Single(c => c.Id == parent.Id);
        top.Replies.Should().HaveCount(2);
        top.Replies.Select(r => r.Content).Should().ContainInOrder("First.", "Second.");
        top.UpvoteCount.Should().Be(3);
        top.HasUpvoted.Should().BeTrue();

        result.Value.Single(c => c.Id == lone.Id).Replies.Should().BeEmpty();
    }

    [Fact]
    public async Task GetForAssignmentAsync_ReplyToAReply_IsASiblingCarryingItsMention()
    {
        // The read side of the flattening. A reply written in answer to another reply comes back as the
        // third *sibling* under the same top-level comment — not nested inside the one it answers — and it
        // is the mention, not the position, that says who it was for.
        var student = EntityBuilders.Student();
        var nadia = EntityBuilders.Student("Nadia Islam", "nadia@test.com");
        var assignment = EntityBuilders.Assignment();

        var root = CommentMocks.Comment(assignment.Id, student, "Top level.");
        var first = CommentMocks.Comment(assignment.Id, nadia, "First.", parentCommentId: root.Id);
        var answeringFirst = CommentMocks.Comment(
            assignment.Id, student, "Answering Nadia.",
            parentCommentId: root.Id, replyToCommentId: first.Id);

        var comments = CommentMocks.Comments().WithThread(
            CommentMocks.Row(root),
            CommentMocks.Row(first),
            CommentMocks.Row(answeringFirst, replyToAuthorName: "Nadia Islam"));

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student, nadia),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .GetForAssignmentAsync(assignment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var top = result.Value.Should().ContainSingle().Subject;

        // Both replies are flat under the root. The tree stays exactly two deep.
        top.Replies.Should().HaveCount(2);
        top.Replies.Should().OnlyContain(r => r.Replies.Count == 0);

        var answer = top.Replies.Single(r => r.Id == answeringFirst.Id);
        answer.ReplyToCommentId.Should().Be(first.Id);
        answer.ReplyToAuthorName.Should().Be("Nadia Islam");

        // The reply that answered the root directly carries no mention.
        top.Replies.Single(r => r.Id == first.Id).ReplyToAuthorName.Should().BeNull();
    }

    [Fact]
    public async Task GetForAssignmentAsync_AddressedCommentDeleted_WithholdsTheMention()
    {
        // Same rule as AuthorName on a tombstone: a deleted comment is not a record of who was removed
        // from the thread, so the mention pointing at it is dropped rather than left naming them. The id
        // goes too — a deleted *reply* is omitted from the read entirely, so the link would dangle.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();

        var root = CommentMocks.Comment(assignment.Id, student, "Top level.");
        var answer = CommentMocks.Comment(
            assignment.Id, student, "Answering someone since deleted.",
            parentCommentId: root.Id, replyToCommentId: Guid.NewGuid());

        var comments = CommentMocks.Comments().WithThread(
            CommentMocks.Row(root),
            CommentMocks.Row(answer, replyToAuthorName: "Nadia Islam", replyToIsDeleted: true));

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .GetForAssignmentAsync(assignment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var reply = result.Value.Should().ContainSingle().Subject.Replies.Should().ContainSingle().Subject;

        // The answer itself is untouched — only the mention is withheld.
        reply.Content.Should().Be("Answering someone since deleted.");
        reply.ReplyToAuthorName.Should().BeNull();
        reply.ReplyToCommentId.Should().BeNull();
    }

    [Fact]
    public async Task GetForAssignmentAsync_DeletedComment_WithholdsContentAndAuthorButKeepsReplies()
    {
        // The soft-delete contract. The tombstone is returned so its replies stay reachable, but neither
        // the original text nor the author's name goes over the wire — a client that ignored IsDeleted
        // could otherwise render both straight out of the network tab.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();
        var deleted = CommentMocks.Comment(assignment.Id, student, "Something regrettable.", deleted: true);
        var reply = CommentMocks.Comment(assignment.Id, student, "A live reply.", deleted.Id);

        var comments = CommentMocks.Comments().WithThread(
            CommentMocks.Row(deleted),
            CommentMocks.Row(reply));

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .GetForAssignmentAsync(assignment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var tombstone = result.Value.Should().ContainSingle().Subject;
        tombstone.IsDeleted.Should().BeTrue();
        tombstone.Content.Should().BeEmpty("a deleted comment's text must not reach the client");
        tombstone.AuthorName.Should().BeEmpty("nor who wrote it");

        tombstone.Replies.Should().ContainSingle()
            .Which.Content.Should().Be("A live reply.", "other people's replies survive the deletion");
    }

    [Fact]
    public async Task GetForAssignmentAsync_AdminOnAnyAssignment_ReturnsSuccess()
    {
        // A6: an admin sees everything and holds no teaching scope, so the rule-4 gate must not be
        // applied to them. Read-only — the controller gives them no POST.
        var admin = EntityBuilders.Admin();
        var assignment = EntityBuilders.Assignment(status: AssignmentStatus.Draft);

        var classes = MockRepositoryHelper.Classes(isAssigned: false);

        var result = await Build(
                CommentMocks.Comments().WithThread(),
                MockRepositoryHelper.AssignmentsWith(assignment),
                classes,
                MockRepositoryHelper.UsersWith(admin),
                MockRepositoryHelper.CurrentUser(admin.Id, Role.Admin))
            .GetForAssignmentAsync(assignment.Id, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        // The rule-4 lookup must not even be attempted for an admin — asserting only on success would
        // pass a service that called it and happened to be allowed through.
        classes.Verify(
            r => r.TeacherAssignmentExistsAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never());
    }

    [Fact]
    public async Task AnyOperation_AnonymousCaller_ReturnsUnauthorized()
    {
        // The service must not trust having been reached through [Authorize] — same reasoning as the
        // equivalent tests on the other services.
        var assignment = EntityBuilders.Assignment();

        var service = Build(
            CommentMocks.Comments(),
            MockRepositoryHelper.AssignmentsEmpty(),
            MockRepositoryHelper.Classes(),
            MockRepositoryHelper.UsersWith(),
            MockRepositoryHelper.AnonymousUser());

        var read = await service.GetForAssignmentAsync(assignment.Id, CancellationToken.None);
        var add = await service.AddAsync(
            assignment.Id, new CreateCommentRequest(AnyContent), CancellationToken.None);
        var delete = await service.DeleteAsync(assignment.Id, Guid.NewGuid(), CancellationToken.None);
        var upvote = await service.ToggleUpvoteAsync(
            assignment.Id, Guid.NewGuid(), CancellationToken.None);

        read.ErrorType.Should().Be(ErrorType.Unauthorized);
        add.ErrorType.Should().Be(ErrorType.Unauthorized);
        delete.ErrorType.Should().Be(ErrorType.Unauthorized);
        upvote.ErrorType.Should().Be(ErrorType.Unauthorized);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task AddAsync_BlankContent_ReturnsFailure(string content)
    {
        // The validator rejects these through the pipeline; this is the service-level safety net, the
        // same belt-and-braces rule 5 uses. Whitespace-only matters: it would otherwise occupy a row in
        // the thread and a slot in the upvote list while saying nothing.
        var student = EntityBuilders.Student();
        var assignment = EntityBuilders.Assignment();

        var comments = CommentMocks.Comments();

        var result = await Build(
                comments,
                MockRepositoryHelper.AssignmentsForStudent(assignment, student.Id),
                MockRepositoryHelper.Classes(),
                MockRepositoryHelper.UsersWith(student),
                MockRepositoryHelper.CurrentUser(student.Id, Role.Student))
            .AddAsync(assignment.Id, new CreateCommentRequest(content), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);
        comments.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }
}
