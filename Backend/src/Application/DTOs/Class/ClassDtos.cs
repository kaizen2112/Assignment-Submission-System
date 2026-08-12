namespace AssignmentSystem.Application.DTOs.Class;

// One class a student is enrolled in, from the student's own point of view.
//
// A separate shape from the admin's EnrollmentResponse rather than a reuse of it, for one reason: that one
// carries StudentId and StudentName because an admin is reading a roster and needs to know *who*. Here the
// student is the caller, so those two fields would be a row telling somebody their own name.
public sealed record EnrolledClassResponse(
    Guid ClassId,
    string ClassName,
    // The short handle ("10A"). Shown alongside the name because that is what appears on a timetable, and
    // two classes can read almost identically ("Class 10 - A" / "Class 10 - B") while their codes do not.
    string ClassCode,
    DateTime EnrolledAt);
