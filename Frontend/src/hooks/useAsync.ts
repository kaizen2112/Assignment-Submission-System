"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

// Runs an async load, aborts it on unmount, and re-runs whenever `loader` changes identity — so a page
// drives refetching by wrapping its loader in useCallback with page/filter in the dependency list.

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface Snapshot<T> {
  // The loader this data belongs to. Comparing it against the current loader during render is what
  // lets a changed loader report `loading` immediately, without a setState in the effect body — which
  // the react-hooks/set-state-in-effect rule forbids (see hooks/useHydrated.ts for the same problem).
  loader: unknown;
  data: T | null;
  error: string | null;
}

// ⚠️ `loader` must be stable for as long as its result is valid: a module-level function, or wrapped in
// useCallback. A bare inline arrow is a new reference every render and would refetch forever.
//
// Assumes a successful load never resolves to null — true of every loader here, and what lets a null
// `data` with no error mean "still loading".
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>): AsyncState<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    loader,
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    loader(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSnapshot({ loader, data, error: null });
      })
      .catch((error: unknown) => {
        // An abort is a navigation or a superseded request, not a failure. Writing state here would
        // also clobber the newer request's result.
        if (controller.signal.aborted) return;
        setSnapshot({ loader, data: null, error: toMessage(error) });
      });

    return () => controller.abort();
  }, [loader]);

  // Derived during render, not stored: the moment the loader changes, whatever is in `snapshot`
  // describes the previous query and must not be shown as if it were the new one.
  const isStale = snapshot.loader !== loader;

  if (isStale) {
    return { data: null, error: null, loading: true };
  }

  return {
    data: snapshot.data,
    error: snapshot.error,
    loading: snapshot.data === null && snapshot.error === null,
  };
}

function toMessage(error: unknown): string {
  // ApiError's message is already the server's own sentence, written for humans.
  if (error instanceof ApiError) return error.message;

  // fetch() rejects with a TypeError when it cannot reach the host at all. "Failed to fetch" tells the
  // user nothing, so name the likely cause — by far the most common failure in development.
  if (error instanceof TypeError) {
    return "Could not reach the API. Check that the backend is running on http://localhost:5274.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}
