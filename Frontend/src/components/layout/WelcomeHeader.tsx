"use client";

import type { ReactNode } from "react";
import { useSession } from "@/components/layout/SessionContext";

// Greets by name once /auth/me has landed, and falls back to a name-less greeting until then rather
// than reserving a shimmer for a single short string.
//
// Matches PageHeader's typography exactly — 24px bold title, gray-500 subtitle — so a dashboard and a
// list page do not look like they came from different apps. It is a separate component only because the
// title is data rather than a constant.
export function WelcomeHeader({
  subtitle,
  action,
}: {
  subtitle: string;
  action?: ReactNode;
}) {
  const profile = useSession();

  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {profile ? `Welcome back, ${profile.fullName}` : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
