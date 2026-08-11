"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EMAIL_MAX, FULL_NAME_MAX } from "@/lib/schemas";
import type { UserBaseValues } from "@/lib/schemas";
import type { Role } from "@/types/api";

// Kept out of UserFields so both callers show the same three options in the same order — and so the
// values stay the exact PascalCase strings the backend parses case-sensitively.
export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "Student", label: "Student" },
  { value: "Teacher", label: "Teacher" },
  { value: "Admin", label: "Admin" },
];

// The three fields create and edit have in common. Read from context rather than taking register/errors
// as props, for the same reason as AssignmentFields: both value types extend this base one, and passing
// UseFormRegister down would need a cast because it is contravariant in its field paths.
//
// Password is deliberately *not* here — the two forms disagree about it. Create requires `password`;
// edit takes an optional `newPassword` where blank means "leave it alone". One shared field pretending
// to cover both would have to lie about whether it is required.
export function UserFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<UserBaseValues>();

  return (
    <>
      <Input
        label="Full name"
        required
        maxLength={FULL_NAME_MAX}
        placeholder="Rafiq Ahmed"
        error={errors.fullName?.message}
        {...register("fullName")}
      />

      <Input
        label="Email"
        type="email"
        required
        maxLength={EMAIL_MAX}
        placeholder="rafiq@school.com"
        hint="Used to sign in. Must be unique across all users."
        error={errors.email?.message}
        {...register("email")}
      />

      <Select
        label="Role"
        required
        options={ROLE_OPTIONS}
        hint="Teachers create and grade assignments. Students submit them. Admins manage everything."
        error={errors.role?.message}
        {...register("role")}
      />
    </>
  );
}
