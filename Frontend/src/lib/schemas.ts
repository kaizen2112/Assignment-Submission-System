import { z } from "zod";

// Client-side validation only. Every rule here is also enforced by the backend — these exist to catch a
// mistake before a pointless round trip and to put the message next to the field, not to be trusted.
// Where a schema mirrors a FluentValidation rule, the limit is copied from the backend validator and
// named below, so the two cannot drift silently.
//
// Zod 4 moved string formats to the top level: `z.email()`, not the deprecated `z.string().email()`.

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  // Deliberately only "not empty". The backend has no FluentValidation validator on LoginRequest — a
  // wrong password is a 401, not a 400 — and inventing a minimum length here would reject a valid
  // credential the server would have accepted. Length rules belong on *setting* a password.
  password: z.string().min(1, "Enter your password."),
});

export type LoginValues = z.infer<typeof loginSchema>;

// --- Assignments ---------------------------------------------------------------------------------

// From CreateAssignmentValidator: TitleMaxLength, DescriptionMaxLength, MinMarks, MaxMarksLimit.
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const MIN_MARKS = 1;
export const MAX_MARKS_LIMIT = 1000;

export const assignmentSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(TITLE_MAX, `Title cannot exceed ${TITLE_MAX} characters.`),

  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(DESCRIPTION_MAX, `Description cannot exceed ${DESCRIPTION_MAX} characters.`),

  // A datetime-local input yields "2026-08-20T23:59" — no timezone. The backend documents a bare
  // timestamp as UTC, so this is validated as a plain string and converted on submit.
  deadline: z
    .string()
    .min(1, "Deadline is required.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time.")
    // Rule 1 makes a past deadline meaningless at creation: nobody could submit against it. The backend
    // rejects it too — this only saves the round trip.
    .refine((value) => new Date(value).getTime() > Date.now(), "Deadline must be in the future."),

  // Plain z.number(), not z.coerce.number(): coerce's *input* type is `unknown` in Zod 4, which stops
  // the resolver type from matching useForm's and makes RHF's inference collapse to bare FieldValues.
  // The field is registered with { valueAsNumber: true } instead, so RHF hands Zod a real number. An
  // empty input arrives as NaN, which z.number() rejects — hence the custom message.
  maxMarks: z
    .number({ error: "Max marks must be a number." })
    .int("Max marks must be a whole number.")
    .min(MIN_MARKS, `Max marks must be between ${MIN_MARKS} and ${MAX_MARKS_LIMIT}.`)
    .max(MAX_MARKS_LIMIT, `Max marks must be between ${MIN_MARKS} and ${MAX_MARKS_LIMIT}.`),

  allowLateSubmission: z.boolean(),
});

// Create additionally needs the class+subject pair. It is one field in the UI — a single picker of pairs
// from /assignments/teaching-scope — because rule 4 grants a pair, so two independent dropdowns could
// offer a combination the server then rejects with a 403.
export const createAssignmentSchema = assignmentSchema.extend({
  teachingScopeKey: z.string().min(1, "Choose a class and subject."),
});

export type AssignmentValues = z.infer<typeof assignmentSchema>;
export type CreateAssignmentValues = z.infer<typeof createAssignmentSchema>;

// --- Submitting ----------------------------------------------------------------------------------

// From SubmitAnswerValidator.AnswerMaxLength.
export const ANSWER_MAX = 5000;

export const submissionSchema = z.object({
  // .trim() before .min(1) mirrors the backend: FluentValidation's NotEmpty() rejects whitespace-only
  // strings for exactly the reason named there — three spaces is not an attempt at the work, but it
  // would otherwise satisfy rule 1 and count as submitted on time.
  answerText: z
    .string()
    .trim()
    .min(1, "Write your answer before submitting.")
    .max(ANSWER_MAX, `Your answer cannot exceed ${ANSWER_MAX} characters.`),
});

export type SubmissionValues = z.infer<typeof submissionSchema>;

// --- Admin: users --------------------------------------------------------------------------------

// From UserRules in Backend/src/Application/Validators/Admin/UserValidators.cs.
export const FULL_NAME_MAX = 200;
export const EMAIL_MAX = 256;
export const PASSWORD_MIN = 8;

// 72 because BCrypt silently truncates beyond 72 bytes — two longer passwords could share a hash.
export const PASSWORD_MAX = 72;

// The backend's rule is deliberately mild: a length floor plus a letter and a digit. Reproduced exactly,
// so the demo credentials in the README satisfy both halves.
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /\d/;

// `allowEmpty` is what makes the edit form's "leave the password alone" case legal. An empty field is
// dropped from the request body entirely (UpdateUserRequest.newPassword is optional), so it must not be
// measured against the length floor — while a *filled* field is held to every rule.
function passwordField(allowEmpty: boolean) {
  const skip = (value: string) => allowEmpty && value === "";

  return z
    .string()
    .refine(
      (value) => skip(value) || value.length >= PASSWORD_MIN,
      `Password must be at least ${PASSWORD_MIN} characters.`,
    )
    .refine(
      (value) => skip(value) || value.length <= PASSWORD_MAX,
      `Password cannot exceed ${PASSWORD_MAX} characters.`,
    )
    .refine(
      (value) => skip(value) || (HAS_LETTER.test(value) && HAS_DIGIT.test(value)),
      "Password must contain at least one letter and one digit.",
    );
}

const userBase = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(FULL_NAME_MAX, `Full name cannot exceed ${FULL_NAME_MAX} characters.`),

  email: z
    .email("Enter a valid email address.")
    .trim()
    .max(EMAIL_MAX, `Email cannot exceed ${EMAIL_MAX} characters.`),

  // Parsed case-sensitively by the backend (Enum.TryParse with ignoreCase: false), so these are the
  // exact three strings it accepts — "teacher" would be a 400.
  role: z.enum(["Admin", "Teacher", "Student"], { error: "Choose a role." }),
});

export const createUserSchema = userBase.extend({ password: passwordField(false) });

export const updateUserSchema = userBase.extend({ newPassword: passwordField(true) });

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type UpdateUserValues = z.infer<typeof updateUserSchema>;

// The three fields create and edit share, for the UserFields component. Both value types above extend
// this one — see the note in AssignmentFields.tsx for why the shared component reads the base type.
export type UserBaseValues = z.infer<typeof userBase>;

// --- Admin: classes and subjects ------------------------------------------------------------------

// From CreateClassValidator and CreateSubjectValidator — these match the varchar widths in docs/02.
export const CLASS_NAME_MAX = 100;
export const CLASS_CODE_MAX = 20;
export const SUBJECT_NAME_MAX = 100;

const CLASS_CODE_PATTERN = /^[A-Za-z0-9-]+$/;

export const classSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(CLASS_NAME_MAX, `Name cannot exceed ${CLASS_NAME_MAX} characters.`),

  // A code is a handle people type and compare ("10A"). The backend rejects spaces and punctuation so
  // that "10 A" and "10-A" cannot coexist as classes nobody can tell apart.
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(CLASS_CODE_MAX, `Code cannot exceed ${CLASS_CODE_MAX} characters.`)
    .regex(CLASS_CODE_PATTERN, "Code may contain only letters, digits and hyphens."),
});

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subject name is required.")
    .max(SUBJECT_NAME_MAX, `Name cannot exceed ${SUBJECT_NAME_MAX} characters.`),
});

export type ClassValues = z.infer<typeof classSchema>;
export type SubjectValues = z.infer<typeof subjectSchema>;

// --- Admin: teacher assignments and enrolments ----------------------------------------------------

// Both fields come from dropdowns of ids the API itself returned, so these are min(1) "did you choose
// one?" checks rather than uuid format checks — a malformed id could only come from a tampered DOM, and
// the server answers that with a 400 of its own.
export const teacherAssignmentSchema = z.object({
  teacherId: z.string().min(1, "Choose a teacher."),
  // One field, not two: the picker offers subjects that already belong to the class, because the
  // backend rejects a subject/class mismatch with a 400.
  subjectId: z.string().min(1, "Choose a subject."),
});

export const enrolmentSchema = z.object({
  studentId: z.string().min(1, "Choose a student."),
});

export type TeacherAssignmentValues = z.infer<typeof teacherAssignmentSchema>;
export type EnrolmentValues = z.infer<typeof enrolmentSchema>;

// --- Grading -------------------------------------------------------------------------------------

// From GradeSubmissionValidator.FeedbackMaxLength.
export const FEEDBACK_MAX = 2000;

// maxMarks is a runtime value (the parent assignment's), so the schema is built per submission. This is
// the client half of rule 5; the authoritative upper-bound check lives in SubmissionService, which is
// the only place that can see the parent assignment.
export function gradeSchema(maxMarks: number) {
  return z.object({
    // Registered with { valueAsNumber: true } — see the note on maxMarks above.
    marks: z
      .number({ error: "Marks must be a number." })
      .int("Marks must be a whole number.")
      .min(0, "Marks cannot be negative.")
      .max(maxMarks, `Marks cannot exceed the maximum of ${maxMarks}.`),

    // Optional in the API (null clears it). An empty textarea becomes null on submit rather than "".
    feedback: z
      .string()
      .max(FEEDBACK_MAX, `Feedback cannot exceed ${FEEDBACK_MAX} characters.`),
  });
}

export type GradeValues = z.infer<ReturnType<typeof gradeSchema>>;
