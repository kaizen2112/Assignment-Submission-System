namespace AssignmentSystem.Application.DTOs.Profile;

// Self-service profile edits.
//
// Neither request carries a user id, and that is the authorization rather than an omission: the caller comes
// from the token, so "may I update this profile?" is a question that cannot be asked. A `UserId` field here
// would turn every one of these into an access-control check somebody has to remember to write.

// FullName only. Email and Role are absent because they are an administrator's to set — an email is an
// identity and a role is an authority — so there is no field to reject rather than a rejection to implement.
public sealed record UpdateProfileRequest(string FullName);

// CurrentPassword is required even though the caller is already authenticated. A valid access token proves
// the session was opened by this user at some point; it does not prove the person at the keyboard right now
// is them. An unattended laptop or a stolen token would otherwise be enough to lock the owner out of their
// own account, which is exactly the case this field exists for.
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
