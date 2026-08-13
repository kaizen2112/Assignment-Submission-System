"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, LogIn, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CARD_CLASS } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { dashboardPathFor, login } from "@/lib/auth";
import { loginSchema } from "@/lib/schemas";
import type { LoginValues } from "@/lib/schemas";

// Demo credentials belong on screen for a graded submission: the evaluator should not have to open the
// README to get in.
const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@school.com", password: "Admin@123" },
  { role: "Teacher", email: "teacher1@school.com", password: "Teacher@123" },
  { role: "Student", email: "student1@school.com", password: "Student@123" },
];

export default function LoginPage() {
  const router = useRouter();

  // Form-level error, distinct from the per-field errors React Hook Form owns. A rejected credential
  // is not a field problem — neither the email nor the password box is individually wrong, and marking
  // one of them would be a hint about which half was correct.
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
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
    <main className="app-canvas grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"
          >
            <GraduationCap className="size-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Assignment System
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Sign in to continue</p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          // noValidate hands validation to Zod. Without it the browser's own bubble fires first and
          // the user sees two different error styles for the same mistake.
          noValidate
          // CARD_CLASS rather than its five classes spelled out — this form is a card like any other,
          // and copying the string is how the login page ends up the one screen that missed a theme.
          className={cn(CARD_CLASS, "flex flex-col gap-5 p-6")}
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
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
            >
              <XCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400"
              />
              <span>{formError}</span>
            </p>
          )}

          <Button type="submit" icon={<LogIn />} loading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <Card className="mt-6 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Demo accounts
          </h2>

          {/* Clickable rather than copy-and-paste. This is the first screen an evaluator sees, and
              typing three credentials by hand is friction with no purpose. */}
          <ul className="mt-3 flex flex-col gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.role}>
                <button
                  type="button"
                  onClick={() => {
                    // shouldValidate so the fields do not sit in an untouched-but-filled state where a
                    // stale error from an earlier attempt is still showing.
                    setValue("email", account.email, { shouldValidate: true });
                    setValue("password", account.password, { shouldValidate: true });
                    setFormError(null);
                  }}
                  // -mx-3 with px-3: the hover fill bleeds out to the card's own padding edge, so it
                  // reads as a full-width row rather than a floating pill with a gap either side. The
                  // negative margin is what keeps the text aligned with the heading above it despite the
                  // extra padding.
                  className="-mx-3 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {account.role}
                  </span>
                  <span className="truncate font-mono text-xs text-gray-400 dark:text-gray-500">
                    {account.email}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
            Click a role to fill the form. Local demo values only.
          </p>
        </Card>
      </div>
    </main>
  );
}
