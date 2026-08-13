import { api } from "@/lib/api";
import type { ChangePasswordRequest, UpdateProfileRequest, UserProfile } from "@/types/api";

// Self-service account edits. Note there is no id in either URL — `me` is the route, so these physically
// cannot be pointed at another account.

// Returns the updated profile in the same shape as GET /auth/me, so the caller can drop it straight into the
// session context rather than mapping a second shape or refetching.
export const updateMyProfile = (body: UpdateProfileRequest) =>
  api.put<UserProfile>("/users/me", body);

// 204 on success — nothing to return, and echoing the profile back would suggest something about it changed.
// A wrong current password is a 400 with a sentence, not a 401: a 401 would send api.ts off to refresh the
// token and then sign the user out over a typo.
export const changeMyPassword = (body: ChangePasswordRequest) =>
  api.put<void>("/users/me/password", body);
