namespace AssignmentSystem.Application.DTOs.Class;

// One class a student is enrolled in, from the student's own point of view.
//
// A separate shape from the admin's EnrollmentResponse rather than a reuse of it, for one reason: that one
// carries StudentId and StudentName because an admin is reading a roster and needs to know *who*. Here the
// student is the caller, so those two fields would be a row telling somebody their own name.
// One person on a class roster, as a classmate sees it.
//
// Name and email and nothing else — deliberately. No marks, no submission counts, no "graded 85/100": a
// roster answers "who is in this class with me", and every path that could answer anything more is a
// teacher's. Assumption A17 in the README covers the email being visible to classmates.
public sealed record ClassmateResponse(
    Guid Id,
    string FullName,
    string Email,
    // True for the caller's own row. Sent rather than left for the client to work out by comparing ids,
    // because the client would need the caller's id to do it and the server already knows.
    bool IsYou);

public sealed record EnrolledClassResponse(
    Guid ClassId,
    string ClassName,
    // The short handle ("10A"). Shown alongside the name because that is what appears on a timetable, and
    // two classes can read almost identically ("Class 10 - A" / "Class 10 - B") while their codes do not.
    string ClassCode,
    DateTime EnrolledAt);
