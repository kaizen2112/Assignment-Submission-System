import { z } from "zod";

// Client-side validation only. Every rule here is also enforced by the backend — these exist to catch
// a mistake before a pointless round trip and to put the message next to the field, not to be trusted.
// Where a schema mirrors a FluentValidation rule, the limits are copied from the backend validator so
// the two cannot drift silently.
//
// Zod 4 moved string formats to the top level: `z.email()`, not the deprecated `z.string().email()`.

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  // Deliberately only "not empty". The backend has no FluentValidation validator on LoginRequest — a
  // wrong password is a 401, not a 400 — and inventing a minimum length here would reject a valid
  // credential the server would have accepted. Length rules belong on *setting* a password, not on
  // using one.
  password: z.string().min(1, "Enter your password."),
});

export type LoginValues = z.infer<typeof loginSchema>;
