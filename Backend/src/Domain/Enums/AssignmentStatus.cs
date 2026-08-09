namespace AssignmentSystem.Domain.Enums;

// Draft is the default on creation. Rule 6: students never see Draft assignments —
// the filter lives in the repository query, not the UI.
public enum AssignmentStatus
{
    Draft,
    Published
}
