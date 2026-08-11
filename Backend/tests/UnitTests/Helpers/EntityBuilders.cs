using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentEntity = AssignmentSystem.Domain.Entities.Assignment;
using SubmissionEntity = AssignmentSystem.Domain.Entities.Submission;

namespace AssignmentSystem.UnitTests.Helpers;

// Every entity here is built through the real Create/Publish/Grade methods — no reflection, no
// test-only constructors. A test therefore cannot arrange a state the production code could not also
// reach, which matters most for rule 8: if a builder could fabricate a Graded submission with no
// GradedAt, the transition tests would be verifying fiction.
//
// Ids are not parameters. Callers read them back off the returned entity (`assignment.Id`) and feed
// that to the mock, exactly as docs/06 does — passing an id in would mean overwriting the one Create
// assigned, and reflection is the only way to do that.
internal static class EntityBuilders
{
    // Fixed offsets from UtcNow rather than fixed dates: a hard-coded 2026 deadline silently becomes
    // "in the past" once the clock passes it, and the rule-1 tests would start failing for no reason.
    internal static DateTime FutureDeadline => DateTime.UtcNow.AddDays(7);

    internal static DateTime PastDeadline => DateTime.UtcNow.AddDays(-2);

    internal static User Student(string fullName = "Test Student", string email = "student@test.com") =>
        User.Create(fullName, email, "not-a-real-hash", Role.Student);

    internal static User Teacher(string fullName = "Test Teacher", string email = "teacher@test.com") =>
        User.Create(fullName, email, "not-a-real-hash", Role.Teacher);

    internal static User Admin(string fullName = "Test Admin", string email = "admin@test.com") =>
        User.Create(fullName, email, "not-a-real-hash", Role.Admin);

    internal static Class Class(string name = "Class 10 - A", string code = "10A") =>
        Domain.Entities.Class.Create(name, code);

    internal static Subject Subject(Guid classId, string name = "Mathematics") =>
        Domain.Entities.Subject.Create(name, classId);

    // Defaults to Published, because that is the state most rules operate on. Pass
    // status: AssignmentStatus.Draft for the rule-6 cases.
    //
    // The Class and Subject navigations are always wired, since AssignmentService.ToResponse reads
    // a.Class.Name and a.Subject.Name on every success path — an unwired assignment throws a
    // NullReferenceException that looks like a product bug but is a test-setup bug.
    internal static AssignmentEntity Assignment(
        DateTime? deadline = null,
        bool allowLateSubmission = false,
        AssignmentStatus status = AssignmentStatus.Published,
        int maxMarks = 100,
        Guid? classId = null,
        Guid? subjectId = null,
        Guid? teacherId = null,
        string title = "Test Assignment",
        string description = "Test description.")
    {
        var @class = Class();
        var resolvedClassId = classId ?? @class.Id;
        var subject = Subject(resolvedClassId);

        var assignment = AssignmentEntity.Create(
            title,
            description,
            deadline ?? FutureDeadline,
            maxMarks,
            resolvedClassId,
            subjectId ?? subject.Id,
            teacherId ?? Guid.NewGuid(),
            allowLateSubmission);

        if (status == AssignmentStatus.Published)
        {
            assignment.Publish();
        }

        assignment.Class = @class;
        assignment.Subject = subject;

        return assignment;
    }

    // Takes the parent assignment rather than an assignmentId, because every rule the service applies
    // to a submission is read through that parent: the deadline (rule 2), MaxMarks (rule 5), and
    // ClassId/SubjectId (rule 4).
    //
    // status is applied through the real transitions — Late comes from Create(isLate: true), Graded
    // from calling Grade — so GradedAt and Marks are always consistent with it.
    internal static SubmissionEntity Submission(
        AssignmentEntity assignment,
        Guid? studentId = null,
        SubmissionStatus status = SubmissionStatus.Submitted,
        string answerText = "Test answer.",
        int gradedMarks = 50,
        string? feedback = "Test feedback.",
        User? student = null)
    {
        var resolvedStudent = student ?? Student();
        var resolvedStudentId = studentId ?? resolvedStudent.Id;

        var submission = SubmissionEntity.Create(
            assignment.Id,
            resolvedStudentId,
            answerText,
            isLate: status == SubmissionStatus.Late);

        if (status == SubmissionStatus.Graded)
        {
            // Clamped so a caller asking for a Graded submission on a 20-mark assignment does not
            // arrange a rule-5 violation and then be surprised when the service rejects it.
            submission.Grade(Math.Min(gradedMarks, assignment.MaxMarks), feedback);
        }

        submission.Assignment = assignment;
        submission.Student = resolvedStudent;

        return submission;
    }

    // A teacher's claim on one class+subject pair. Class and Subject are always wired, because
    // AssignmentService.ToTeachingScope reads ta.Class.Name/.Code and ta.Subject.Name — leaving them
    // null throws a NullReferenceException that looks like a product bug but is a test-setup bug.
    internal static TeacherAssignment TeacherAssignment(
        Guid teacherId,
        Class? @class = null,
        Subject? subject = null)
    {
        var resolvedClass = @class ?? Class();
        var resolvedSubject = subject ?? Subject(resolvedClass.Id);

        var teacherAssignment = Domain.Entities.TeacherAssignment.Create(
            teacherId,
            resolvedSubject.Id,
            resolvedClass.Id);

        teacherAssignment.Class = resolvedClass;
        teacherAssignment.Subject = resolvedSubject;

        return teacherAssignment;
    }

    // The one graph the service tests need most: an assignment plus the teacher who owns it, the
    // student enrolled in its class, and that student's submission — all ids already agreeing.
    internal static Scenario BuildScenario(
        DateTime? deadline = null,
        bool allowLateSubmission = false,
        AssignmentStatus status = AssignmentStatus.Published,
        int maxMarks = 100,
        SubmissionStatus submissionStatus = SubmissionStatus.Submitted)
    {
        var teacher = Teacher();
        var student = Student();
        var @class = Class();
        var subject = Subject(@class.Id);

        var assignment = AssignmentEntity.Create(
            "Test Assignment",
            "Test description.",
            deadline ?? FutureDeadline,
            maxMarks,
            @class.Id,
            subject.Id,
            teacher.Id,
            allowLateSubmission);

        if (status == AssignmentStatus.Published)
        {
            assignment.Publish();
        }

        assignment.Class = @class;
        assignment.Subject = subject;

        var submission = Submission(assignment, student.Id, submissionStatus, student: student);

        return new Scenario(teacher, student, @class, subject, assignment, submission);
    }

    internal sealed record Scenario(
        User Teacher,
        User Student,
        Class Class,
        Subject Subject,
        AssignmentEntity Assignment,
        SubmissionEntity Submission);
}
