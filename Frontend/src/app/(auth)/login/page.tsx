"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { dashboardPathFor, login } from "@/lib/auth";

// Minimal but functional, so the redirect target in page.tsx and middleware.ts actually resolves.
// Step 2 replaces the hand-rolled state below with React Hook Form + a Zod schema mirroring the
// backend validators; the login call itself will not change.
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await login(email.trim(), password);

    if (!result.ok || !result.user) {
      setError(result.error ?? "Unable to sign in.");
      setSubmitting(false);
      return;
    }

    // replace, not push: the back button should not return to a login form the user has passed.
    router.replace(dashboardPathFor(result.user.role));
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Assignment System</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher1@school.com"
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* role="alert" so the failure is announced, not just displayed. The message comes from the
              API, which returns one sentence for both a wrong email and a wrong password. */}
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
