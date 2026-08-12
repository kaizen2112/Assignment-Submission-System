"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { UserFields } from "@/components/admin/UserFields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormActions, FormCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/lib/api";
import { findUser, updateUser } from "@/lib/admin";
import { PASSWORD_MAX, PASSWORD_MIN, updateUserSchema } from "@/lib/schemas";
import type { UpdateUserValues } from "@/lib/schemas";
import { formatDateTime } from "@/lib/utils";

// newPassword maps onto the server's `newPassword`, so the same list covers both directions.
const SERVER_FIELDS = ["fullName", "email", "role", "newPassword"] as const;

export default function EditUserPage() {
  const router = useRouter();
  // useParams rather than a page prop: this is a client component, and Next 16 delivers page params as a
  // Promise a client component cannot await during render.
  const { id } = useParams<{ id: string }>();

  const [formError, setFormError] = useState<string | null>(null);

  const loader = useCallback((signal: AbortSignal) => findUser(id, signal), [id]);
  const { data: user, error: loadError, loading } = useAsync(loader);

  const methods = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    mode: "onBlur",
    defaultValues: { fullName: "", email: "", role: "Student", newPassword: "" },
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = methods;

  // The form exists before the user arrives, so values are filled in afterwards. reset() rather than
  // setValue per field: it also clears dirty/touched state, so the loaded values become the baseline
  // instead of reading as unsaved edits.
  useEffect(() => {
    if (!user) return;

    reset({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      // Always blank on load. Pre-filling anything here would either send a password nobody asked to
      // change, or show a hash — and the API never returns one.
      newPassword: "",
    });
  }, [user, reset]);

  const onSubmit = async (values: UpdateUserValues) => {
    setFormError(null);

    try {
      await updateUser(id, {
        fullName: values.fullName,
        email: values.email,
        role: values.role,
        // Omitted entirely when blank. Sending "" would fail the server's password rules, which only
        // apply to a field that is present — that is what "leave the password alone" means on the wire.
        ...(values.newPassword ? { newPassword: values.newPassword } : {}),
      });

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

        // Two 409s reach this branch: the email belongs to someone else, or the role change contradicts
        // assignments or submissions already on record. Both sentences name the reason, so both are shown
        // verbatim.
        if (!matched) setFormError(caught.message);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Edit user" backHref="/admin/users" backLabel="Users" />
        <SkeletonRegion label="Loading user" className="max-w-2xl">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <Skeleton className="mb-5 h-3 w-24" />
            <Skeleton className="mb-4 h-10 w-full rounded-lg" />
            <Skeleton className="mb-4 h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </SkeletonRegion>
      </>
    );
  }

  if (loadError || !user) {
    return (
      <>
        <PageHeader title="Edit user" backHref="/admin/users" backLabel="Users" />
        <Alert className="mb-6">{loadError ?? "This user could not be found."}</Alert>
        <Link href="/admin/users">
          <Button variant="secondary">Back to users</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={user.fullName}
        subtitle={`Account created ${formatDateTime(user.createdAt)}`}
        backHref="/admin/users"
        backLabel="Users"
        crumbs={[{ label: "Users", href: "/admin/users" }, { label: user.fullName }]}
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

            {/* Changing a role is refused with a 409 once the user has assignments or submissions on
                record — their existing rows would describe someone whose role makes those rows
                impossible. Said up front, because the form cannot tell in advance which users are
                affected: nothing in the list response reports it. */}
            <Alert tone="info">
              A role can only be changed while the user has no assignments or submissions on record.
            </Alert>
          </FormCard>

          <FormCard
            label="Reset password"
            description="Leave blank to keep the current password."
          >
            <Input
              label="New password"
              type="text"
              autoComplete="off"
              maxLength={PASSWORD_MAX}
              placeholder="Leave blank to keep the current password"
              hint={`Only fill this in to reset the password. At least ${PASSWORD_MIN} characters, with at least one letter and one digit.`}
              error={errors.newPassword?.message}
              {...register("newPassword")}
            />
          </FormCard>

          <FormActions>
            <Button type="submit" icon={<Save />} loading={isSubmitting}>
              Save changes
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
