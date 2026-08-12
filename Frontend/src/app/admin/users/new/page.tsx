"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { UserFields } from "@/components/admin/UserFields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormActions, FormCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api";
import { createUser } from "@/lib/admin";
import { createUserSchema, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas";
import type { CreateUserValues } from "@/lib/schemas";

// Field names that line up between this form and the API's validation errors, so a 400 lands next to the
// offending input instead of in a banner. camelCase because that is how the ValidationProblems filter
// keys them.
const SERVER_FIELDS = ["fullName", "email", "role", "password"] as const;

export default function NewUserPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const methods = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      // Student rather than blank: it is by far the most common account to create, and a native <select>
      // with no value would otherwise submit whichever option happened to render first.
      role: "Student",
      password: "",
    },
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = methods;

  const onSubmit = async (values: CreateUserValues) => {
    setFormError(null);

    try {
      await createUser(values);
      router.replace("/admin/users");
    } catch (caught) {
      if (caught instanceof ApiError) {
        let matched = false;

        for (const field of SERVER_FIELDS) {
          const message = caught.fieldError(field);
          if (message) {
            setError(field, { message });
            matched = true;
          }
        }

        // A 409 — the email is already taken — has no field errors attached, so it surfaces here.
        if (!matched) setFormError(caught.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <PageHeader
        title="New user"
        subtitle="The account works immediately. Teachers and students still need a class before they can do anything."
        backHref="/admin/users"
        backLabel="Users"
        crumbs={[{ label: "Users", href: "/admin/users" }, { label: "New" }]}
      />

      {formError && <Alert className="mb-6">{formError}</Alert>}

      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex max-w-2xl flex-col gap-6"
        >
          <FormCard label="Account">
            <UserFields />
          </FormCard>

          <FormCard
            label="Password"
            description="There is no self-service reset, so an admin sets and communicates this."
          >
            <Input
              label="Password"
              // type="text", not "password". This is an admin typing a credential they must then read
              // out to someone else — masking it invites a typo nobody can see, and there is no
              // self-service reset anywhere in the system to recover from one.
              type="text"
              required
              autoComplete="off"
              maxLength={PASSWORD_MAX}
              placeholder="Learn2026"
              hint={`At least ${PASSWORD_MIN} characters, with at least one letter and one digit. Write it down — you will need to give it to the user.`}
              error={errors.password?.message}
              {...register("password")}
            />
          </FormCard>

          <FormActions>
            <Button type="submit" icon={<UserPlus />} loading={isSubmitting}>
              Create user
            </Button>

            <Link href="/admin/users">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </FormActions>
        </form>
      </FormProvider>
    </>
  );
}
