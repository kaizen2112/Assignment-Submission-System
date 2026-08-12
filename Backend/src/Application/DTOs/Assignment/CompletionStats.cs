namespace AssignmentSystem.Application.DTOs.Assignment;

// How much of a class has handed in one assignment. Attached to the assignment responses rather than
// served from an endpoint of its own: it is read on exactly the screens that already load an assignment,
// and a separate call would mean the two could disagree about which assignment they describe.
//
// Only ever populated for a Teacher or an Admin — see AssignmentService. A student is told nothing about
// how many of their classmates have submitted.
public sealed record CompletionStats(int TotalEnrolled, int TotalSubmitted)
{
    // Computed here rather than in SQL, for two reasons.
    //
    // The first is division by zero: a class with no enrolled students has no meaningful completion, and
    // the answer has to be *decided* rather than left to whatever the database does with 0/0. Zero is the
    // honest value — nothing has been submitted — and the UI renders an em dash instead of "0%" when
    // TotalEnrolled is 0, because "0% of nobody" is a different statement from "0% of eighteen".
    //
    // The second is testability. If the percentage arrived from the repository, every test of it would be
    // a test of a mock's canned return value: the service would pass the number through and no assertion
    // could distinguish a correct calculation from a hard-coded one. Two counts in, one derived figure
    // out, computed in code a unit test can actually reach.
    public double Percentage =>
        TotalEnrolled == 0 ? 0 : Math.Round((double)TotalSubmitted / TotalEnrolled * 100, 1);
}
