using System.Runtime.CompilerServices;

// Opens this assembly's internal members to the test project only.
//
// What it is for: the navigation properties (Assignment.Class, Submission.Assignment, …) are populated
// by EF Core at materialization time and by nothing else — no factory method sets them, because in
// production no application code ever should. Unit tests still have to hand a service the same object
// graph EF would have handed it, so those four setters are `internal` rather than `private`.
//
// What it is deliberately NOT for: there is no test-only constructor and no ForTestingOnly factory.
// Tests build entities through the real Create/Publish/Grade methods, so a test can never reach a
// state the production code could not also produce — which is the whole point of testing them.
[assembly: InternalsVisibleTo("AssignmentSystem.UnitTests")]
