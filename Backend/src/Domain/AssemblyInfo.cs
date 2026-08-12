using System.Runtime.CompilerServices;

// Opens this assembly's internal members to the test project only.
//
// What it is for: the navigation properties (Assignment.Class, Submission.Assignment, …) are populated
// by EF Core at materialization time and by nothing else — no factory method sets them, because in
// production no application code ever should. Unit tests still have to hand a service the same object
// graph EF would have handed it, so those setters are `internal` rather than `private`.
//
// Comment and CommentUpvote follow the same rule. Note Comment has no Assignment navigation at all —
// deliberately, so the only route to the parent is IAssignmentRepository and its scoped queries.
//
// What it is deliberately NOT for: there is no test-only constructor and no ForTestingOnly factory.
// Tests build entities through the real Create/Publish/Grade methods, so a test can never reach a
// state the production code could not also produce — which is the whole point of testing them.
[assembly: InternalsVisibleTo("AssignmentSystem.UnitTests")]
