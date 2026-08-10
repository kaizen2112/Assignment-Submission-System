"use client";

import { createContext, useContext } from "react";
import type { UserProfile } from "@/types/api";

// AppShell already loads GET /auth/me for the header. Publishing the result here lets pages inside the
// shell greet the user by name without issuing a second identical request — the alternative was every
// dashboard fetching /me for itself.
//
// `profile` is null until the request lands, so consumers must handle that frame rather than assuming
// a name is available on first render.
const SessionContext = createContext<UserProfile | null>(null);

export const SessionProvider = SessionContext.Provider;

export function useSession(): UserProfile | null {
  return useContext(SessionContext);
}
