using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Class;
using AssignmentSystem.Application.DTOs.Common;

namespace AssignmentSystem.Application.Interfaces;

// The student-facing view of classes, and the counterpart to IAdminService's class management: an admin
// creates classes and enrols people into them, a student reads which ones they are in.
//
// Kept separate from IAdminService rather than added to it, because everything on that interface is
// Admin-only by construction — a student-callable method sitting among them would be the one exception
// somebody has to notice.
public interface IClassService
{
    // Scoped to the caller and to nobody else: the student id comes from the token, never from a
    // parameter, so there is no id to tamper with and no "whose classes?" question to get wrong.
    //
    // Paginated like every other list in the system even though a student's enrolment count is small —
    // the one exception is a comment thread, and that has a documented reason.
    Task<Result<PagedResult<EnrolledClassResponse>>> GetMyClassesAsync(
        PagedQueryParameters query,
        CancellationToken cancellationToken = default);

    // The roster of a class the caller is enrolled in.
    //
    // classId is a parameter here, unlike GetMyClassesAsync — a student may be in several classes, so the
    // one being asked about has to be named. That makes enrolment the gate: the service checks the caller is
    // in *this* class before returning anybody, so the id cannot be edited into another class's roster.
    Task<Result<PagedResult<ClassmateResponse>>> GetClassmatesAsync(
        Guid classId,
        PagedQueryParameters query,
        CancellationToken cancellationToken = default);
}
