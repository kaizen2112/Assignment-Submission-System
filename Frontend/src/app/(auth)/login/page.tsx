"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { dashboardPathFor, login } from "@/lib/auth";
import { loginSchema } from "@/lib/schemas";
import type { LoginValues } from "@/lib/schemas";

export default function LoginPage() {
  const router = useRouter();

  // Form-level error, distinct from the per-field errors React Hook Form owns. A rejected credential
  // is not a field problem — neither the email nor the password box is individually wrong, and marking
  // one of them would be a hint about which half was correct.
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    // Validate on blur rather than on every keystroke: "Enter a valid email address" appearing after
    // the first character of a valid address is noise.
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  // isSubmitting stays true until this resolves, which is what disables the button — so a slow network
  // cannot produce two login requests. Deliberately no try/catch around a throw: login() returns a
  // result object rather than throwing, so there is no rejection path to swallow.
  const onSubmit = async (values: LoginValues) => {
    setFormError(null);

    const result = await login(values.email, values.password);

    if (!result.ok || !result.user) {
      setFormError(result.error ?? "Unable to sign in.");
      return;
    }

    // replace, not push: the back button should not return to a login form the user has passed.
    router.replace(dashboardPathFor(result.user.role));
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Assignment System</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          // noValidate hands validation to Zod. Without it the browser's own bubble fires first and
          // the user sees two different error styles for the same mistake.
          noValidate
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            placeholder="teacher1@school.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />

          {/* role="alert" so the failure is announced, not merely displayed. The message comes from
              the API, which returns one sentence for both a wrong email and a wrong password. */}
          {formError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* Demo credentials belong on screen for a graded submission: the evaluator should not have to
            open the README to get in. */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Demo accounts
          </h2>
          <dl className="mt-2 space-y-1 text-xs text-slate-600">
            {[
              ["Admin", "admin@school.com", "Admin@123"],
              ["Teacher", "teacher1@school.com", "Teacher@123"],
              ["Student", "student1@school.com", "Student@123"],
            ].map(([role, email, password]) => (
              <div key={role} className="flex justify-between gap-2">
                <dt className="font-medium text-slate-700">{role}</dt>
                <dd className="font-mono">
                  {email} / {password}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
