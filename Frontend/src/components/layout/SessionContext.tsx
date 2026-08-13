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

// The setter, in a second context rather than bundled into the first.
//
// Bundling would have meant `useSession()` returning `{ profile, setProfile }`, which changes the shape every
// existing consumer reads — the sidebar footer, the welcome header — for the benefit of the one screen that
// writes. Two contexts keeps the common case a plain value.
//
// This exists so the profile page can push a renamed user straight into the top bar and sidebar without
// refetching /auth/me. A no-op default rather than a nullable one: a component outside the shell has nothing
// to update, and making every caller check would spread that fact for no gain.
const SessionUpdateContext = createContext<(profile: UserProfile) => void>(() => {});

export const SessionUpdateProvider = SessionUpdateContext.Provider;

export function useSessionUpdate(): (profile: UserProfile) => void {
  return useContext(SessionUpdateContext);
}
