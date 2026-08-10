"use client";

import { useSession } from "@/components/layout/SessionContext";

// Greets by name once /auth/me has landed, and falls back to a name-less greeting until then rather
// than reserving a shimmer for a single short string.
export function WelcomeHeader({ subtitle }: { subtitle: string }) {
  const profile = useSession();

  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold text-slate-900">
        {profile ? `Welcome back, ${profile.fullName}` : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </header>
  );
}
