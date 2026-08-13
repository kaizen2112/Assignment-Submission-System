"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, SlidersHorizontal, UserCog, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSession, useSessionUpdate } from "@/components/layout/SessionContext";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CARD_CLASS } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useHydrated } from "@/hooks/useHydrated";
import { ApiError } from "@/lib/api";
import { getTeachingScope } from "@/lib/assignments";
import { listMyClasses } from "@/lib/classes";
import { changeMyPassword, updateMyProfile } from "@/lib/profile";
import { cn, formatDate, ROLE_TONES } from "@/lib/utils";
import type { Role } from "@/types/api";

// One profile screen for all three roles, mounted at /admin/profile, /teacher/profile and /student/profile.
//
// One component rather than three, because the differences are one card's contents — and three copies of a
// password form is three places for a security fix to be applied twice and missed once. The role-specific part
// is `ClassInfoCard` and nothing else.
//
// Everything here reads the session context rather than fetching /auth/me again: AppShell has already loaded
// it for the header.

// --- Collapsible card ----------------------------------------------------------------------------

// <details>/<summary>, not useState. Native disclosure is keyboard-accessible, works before hydration, and is
// findable by the browser's own in-page search — all of which a div with an onClick has to re-implement, badly.
function Section({
  icon,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn(CARD_CLASS, "group")}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 p-5",
          // `list-none` plus this kills the default triangle in every engine; the chevron below is ours so it
          // can rotate with the open state.
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 dark:bg-gray-900/50 dark:text-gray-500 [&>svg]:size-4.5"
        >
          {icon}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
        </span>

        {/* An inline SVG rather than a Lucide import, because it has to rotate off the parent's open state and
            a CSS transform on a component's root is the one thing that reads more clearly written out. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180 dark:text-gray-500"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="border-t border-gray-100 p-5 dark:border-gray-700">{children}</div>
    </details>
  );
}

function ReadOnlyField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 wrap-break-word text-sm text-gray-600 dark:text-gray-300">{value}</p>
        {children}
      </div>
    </div>
  );
}

// --- Basic info ----------------------------------------------------------------------------------

function BasicInfoCard() {
  const profile = useSession();
  const updateSession = useSessionUpdate();

  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Null until the user types, so the input shows the live profile name while it is still loading and only
  // becomes a controlled draft once they touch it. Seeding state from `profile` directly would need an effect
  // to catch the value arriving after mount.
  const value = name ?? profile?.fullName ?? "";
  const dirty = profile !== null && value.trim() !== profile.fullName && value.trim().length > 0;

  const save = async () => {
    if (!dirty || !profile) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updated = await updateMyProfile({ fullName: value.trim() });

      // Straight into the session context, so the top bar and the sidebar footer show the new name immediately
      // rather than keeping the old one until a reload.
      updateSession(updated);
      setName(null);
      setSaved(true);
    } catch (caught) {
      // The server's own sentence — it already names the field limit — rather than a generic replacement.
      setError(caught instanceof ApiError ? caught.message : "Could not save your name.");
    } finally {
      setSaving(false);
    }
  };

  const copyEmail = async () => {
    if (!profile) return;

    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused outright (an insecure origin, a permission policy). Silently doing
      // nothing is right: the address is on screen and selectable, so nothing is actually lost.
    }
  };

  return (
    <Section
      icon={<UserCog />}
      title="Basic info"
      hint="Your name, and the details only an administrator can change"
      defaultOpen
    >
      <div className="flex max-w-md flex-col gap-5">
        <div>
          <Input
            label="Full name"
            value={value}
            maxLength={200}
            disabled={!profile || saving}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            // Enter saves, because a single-field form where Enter does nothing feels broken.
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
          />

          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" onClick={() => void save()} disabled={!dirty} loading={saving}>
              Save name
            </Button>

            {/* One line for all three outcomes, so they cannot stack up and contradict each other. */}
            {saving ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">Saving…</span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <Check aria-hidden="true" className="size-3.5" />
                Saved
              </span>
            ) : dirty ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">Unsaved changes</span>
            ) : null}
          </div>

          {error && (
            <Alert className="mt-3" tone="error">
              {error}
            </Alert>
          )}
        </div>

        <ReadOnlyField label="Email" value={profile?.email ?? "…"}>
          <button
            type="button"
            onClick={() => void copyEmail()}
            aria-label="Copy email address"
            title="Copy email address"
            className="shrink-0 rounded-md p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
          </button>
        </ReadOnlyField>

        {/* Read-only, and the API has no field for either — an email is an identity and a role is an authority,
            so both are an administrator's to set. The restriction is in the request shape, not in this form
            choosing not to offer them. */}
        <ReadOnlyField label="Role" value="">
          {profile ? (
            <Badge tone={ROLE_TONES[profile.role]}>{profile.role}</Badge>
          ) : (
            <Skeleton className="h-5 w-16" />
          )}
        </ReadOnlyField>

        <ReadOnlyField
          label="Member since"
          value={profile ? formatDate(profile.createdAt) : "…"}
        />
      </div>
    </Section>
  );
}

// --- Security ------------------------------------------------------------------------------------

function SecurityCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checked here as well as on the server, and it is the one rule the server cannot check: it never receives
  // the confirmation field, because sending a value whose only purpose is to be compared with another value in
  // the same form would be asking the API to validate a typo.
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current.length > 0 && next.length > 0 && !mismatch;

  const submit = async () => {
    setSaving(true);
    setError(null);
    setDone(false);

    try {
      await changeMyPassword({ currentPassword: current, newPassword: next });

      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (caught) {
      // "Your current password is incorrect" and the strength rules both arrive as the server's own sentences.
      setError(caught instanceof ApiError ? caught.message : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={<KeyRound />} title="Security" hint="Change your password">
      <form
        // A real form, so a password manager recognises it and offers to update the stored credential.
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex max-w-md flex-col gap-4"
      >
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />

        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          hint="At least 8 characters, with a letter and a digit."
          onChange={(event) => setNext(event.target.value)}
        />

        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={mismatch ? "The two passwords do not match." : undefined}
          onChange={(event) => setConfirm(event.target.value)}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!ready} loading={saving}>
            Change password
          </Button>

          {done && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <Check aria-hidden="true" className="size-3.5" />
              Password changed
            </span>
          )}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        {/* Said out loud rather than left to be discovered. Changing a password ideally ends every other
            session; this one does not, and a user who assumes otherwise would be wrong about something that
            matters. Recorded as a known limitation in the README. */}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          You will stay signed in on your other devices. Sign out there separately if you need to.
        </p>
      </form>
    </Section>
  );
}

// --- Preferences ---------------------------------------------------------------------------------

type ThemeChoice = "light" | "dark" | "system";

function readTheme(): ThemeChoice {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

function PreferencesCard() {
  // The theme lives in localStorage and NOT in the users table, deliberately.
  //
  // The no-flash requirement is what forces it: the inline script in the root layout reads the choice
  // *synchronously during HTML parsing*, before any request could have returned. A column on `users` could
  // only be read after /auth/me lands, which is after first paint — so it could never drive the initial theme,
  // only correct it a frame later, which is the flash the script exists to prevent. Storing it server-side
  // would have created a second source of truth that loses every race with the first.
  //
  // The trade-off, stated plainly: the choice does not follow the account to another browser. That is the
  // price of it being right on the first frame, and it is the right way round.
  const hydrated = useHydrated();
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  // Read during render rather than in an effect — localStorage is synchronous, and `hydrated` is what keeps
  // the server and client markup identical until it is safe to look.
  const active = choice ?? (hydrated ? readTheme() : "system");

  const apply = (value: ThemeChoice) => {
    if (value === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", value);
    }

    // The same two lines the inline script and ThemeToggle use: the class on <html> is the source of truth, so
    // it is set from the resolved value rather than from a mirror of it held in React.
    const dark =
      value === "dark" ||
      (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
    setChoice(value);
  };

  const options: { value: ThemeChoice; label: string; hint: string }[] = [
    { value: "light", label: "Light", hint: "Always light" },
    { value: "dark", label: "Dark", hint: "Always dark" },
    { value: "system", label: "System", hint: "Follow your device" },
  ];

  return (
    <Section icon={<SlidersHorizontal />} title="Preferences" hint="Appearance and language">
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Theme
          </legend>

          <div className="mt-2 flex flex-col gap-1">
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                  "transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-900/50",
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={active === option.value}
                  disabled={!hydrated}
                  onChange={() => apply(option.value)}
                  className="size-4 shrink-0 accent-indigo-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{option.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{option.hint}</span>
              </label>
            ))}
          </div>

          <p className="mt-2 px-3 text-xs text-gray-400 dark:text-gray-500">
            Saved in this browser, so it applies before the page paints. It does not follow your account to
            another device.
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Language
          </legend>

          <div className="mt-2 flex flex-col gap-1">
            <label className="flex items-center gap-3 rounded-lg px-3 py-2">
              <input
                type="radio"
                name="language"
                checked
                readOnly
                className="size-4 shrink-0 accent-indigo-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">English</span>
            </label>

            {/* Disabled rather than absent, and labelled as such. An option that is coming is worth showing;
                one that silently does nothing is not. */}
            <label className="flex items-center gap-3 rounded-lg px-3 py-2 opacity-50">
              <input type="radio" name="language" disabled className="size-4 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-200">বাংলা</span>
              <Badge>Coming soon</Badge>
            </label>
          </div>
        </fieldset>
      </div>
    </Section>
  );
}

// --- Class info ----------------------------------------------------------------------------------

function TeacherClassInfo() {
  const { data, error } = useAsync(getTeachingScope);

  if (error) return <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>;
  if (!data) return <Skeleton className="h-5 w-48" />;

  // Grouped here for the same reason as in the sidebar: the endpoint returns flat (class, subject) pairs
  // because that is what the create form needs.
  const byClass = new Map<string, { name: string; code: string; subjects: string[] }>();
  for (const pair of data.items) {
    const existing = byClass.get(pair.classId);
    if (existing) existing.subjects.push(pair.subjectName);
    else
      byClass.set(pair.classId, {
        name: pair.className,
        code: pair.classCode,
        subjects: [pair.subjectName],
      });
  }

  const classes = [...byClass.entries()];

  if (classes.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You have not been assigned to any class yet. An administrator has to grant you a class and subject
        before you can create assignments.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {classes.map(([classId, info]) => (
        <li key={classId}>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {info.name}{" "}
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">{info.code}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {info.subjects.map((subject) => (
              <Badge key={subject} tone="accent">
                {subject}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StudentClassInfo() {
  const { data, error } = useAsync(listMyClasses);

  if (error) return <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>;
  if (!data) return <Skeleton className="h-5 w-48" />;

  if (data.items.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        You are not enrolled in a class yet. An administrator has to enrol you before assignments appear.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.items.map((enrolled) => (
        <li key={enrolled.classId} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {enrolled.className}
          </span>
          <Badge>{enrolled.classCode}</Badge>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            enrolled {formatDate(enrolled.enrolledAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ClassInfoCard({ role }: { role: Role }) {
  // Admin holds neither a teaching grant nor an enrolment, so there is nothing here for them — and a card
  // reading "none" would be noise. They reach every class through /admin/classes.
  if (role === "Admin") return null;

  return (
    <Section
      icon={<Users />}
      title={role === "Teacher" ? "Classes you teach" : "Your class"}
      hint={
        role === "Teacher"
          ? "The class and subject pairs you may create assignments for"
          : "Where your assignments come from"
      }
    >
      {role === "Teacher" ? <TeacherClassInfo /> : <StudentClassInfo />}
    </Section>
  );
}

// --- The page ------------------------------------------------------------------------------------

export function ProfileView({ role }: { role: Role }) {
  const profile = useSession();

  return (
    <>
      <PageHeader
        title="Your profile"
        subtitle="Your account details, security and preferences."
        crumbs={[{ label: role }, { label: "Profile" }]}
      />

      {/* The header block. Avatar initials rather than an uploaded image: there is no file storage in this
          system (assumption A3), so an avatar upload would need object storage, a size and MIME policy and an
          authorised download path — and initials read perfectly well at this size. */}
      <div className={cn(CARD_CLASS, "mb-6 flex flex-wrap items-center gap-4 p-5")}>
        {/* md is the largest size Avatar offers. Left as it is rather than adding an "lg": the component is
            shared by tables, the sidebar and the top bar, and a new size exists to be misused by all three. */}
        {profile ? (
          <Avatar fullName={profile.fullName} size="md" />
        ) : (
          <Skeleton className="size-8 rounded-full" />
        )}

        <div className="min-w-0">
          {profile ? (
            <>
              <p className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                {profile.fullName}
              </p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
            </>
          ) : (
            <>
              <Skeleton className="mb-2 h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </>
          )}
        </div>

        {profile && (
          <div className="ml-auto">
            <Badge tone={ROLE_TONES[profile.role]}>{profile.role}</Badge>
          </div>
        )}
      </div>

      <div className="flex max-w-3xl flex-col gap-4">
        <BasicInfoCard />
        <SecurityCard />
        <PreferencesCard />
        <ClassInfoCard role={role} />
      </div>
    </>
  );
}
