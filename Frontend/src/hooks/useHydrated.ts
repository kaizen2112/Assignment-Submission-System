"use client";

import { useSyncExternalStore } from "react";

// False during server rendering and on the very first client render, true afterwards.
//
// This is the supported way to branch on "can I touch the browser yet?". Reading localStorage during
// render would produce different HTML on the server than on the client and break hydration; flipping a
// useState from an effect would work but adds a synchronous cascading render, which is what the
// react-hooks/set-state-in-effect rule exists to prevent. useSyncExternalStore's third argument is the
// server snapshot, so React deliberately renders `false` for the initial HTML and re-reads afterwards.
//
// `subscribe` is a module-level constant on purpose: an inline arrow would be a new reference on every
// render and re-subscribe forever. Nothing ever calls the callback, because this value only changes
// once — at hydration — and React handles that transition itself.
const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
