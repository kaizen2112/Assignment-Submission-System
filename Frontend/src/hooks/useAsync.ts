"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

// Runs one async load on mount, aborts it on unmount, and reports loading/data/error as a single state
// object so a component cannot render an impossible combination (data *and* loading, say).

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// ⚠️ `loader` must be a stable reference — a module-level function, or wrapped in useCallback. An inline
// arrow is a new function on every render, which would re-trigger the effect forever. It is in the
// dependency array on purpose: silencing the lint rule instead would hide that requirement.
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    loader(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        // An abort is a navigation, not a failure. Writing state here would also be a write into an
        // unmounting component.
        if (controller.signal.aborted) return;
        setState({ data: null, error: toMessage(error), loading: false });
      });

    return () => controller.abort();
  }, [loader]);

  return state;
}

function toMessage(error: unknown): string {
  // ApiError's message is already the server's own sentence, written for humans.
  if (error instanceof ApiError) return error.message;

  // fetch() rejects with a TypeError when it cannot reach the host at all. "Failed to fetch" tells the
  // user nothing, so name the likely cause — this is by far the most common failure in development.
  if (error instanceof TypeError) {
    return "Could not reach the API. Check that the backend is running on http://localhost:5274.";
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}
