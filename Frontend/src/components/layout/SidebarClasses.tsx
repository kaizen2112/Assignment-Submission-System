"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, GraduationCap, Users } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { getTeachingScope } from "@/lib/assignments";
import { listMyClasses } from "@/lib/classes";
import { cn } from "@/lib/utils";
import type { TeachingScope } from "@/types/api";

// The classes section of the sidebar, in two shapes: a teacher's collapsible class → subject tree, and a
// student's flat list with a link to the roster.
//
// Both live in one file because they share the section chrome — the heading, the loading line, the empty
// line — and two files would have meant two copies of it drifting apart. They share no data path: a teacher
// reads their teaching scope, a student reads their enrolments.
//
// Everything here is a <Link>, never client-side filter state. Clicking a subject navigates to
// /teacher/assignments?classId=…&subjectId=…, which means the filtered view is shareable, survives a reload
// and gets the back button for free — none of which a useState filter would give.

// --- Shared chrome -------------------------------------------------------------------------------

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-white/40">
      {children}
    </p>
  );
}

function Quiet({ children }: { children: string }) {
  return <p className="px-3 py-1.5 text-xs text-white/40">{children}</p>;
}

// One row in the tree. A shared shape so a class button and a subject link cannot drift apart on height or
// hover treatment — the only difference between them is the indent and the left rule.
const ROW = cn(
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
  "transition-colors duration-150",
);

// --- Teacher -------------------------------------------------------------------------------------

interface ClassGroup {
  classId: string;
  className: string;
  classCode: string;
  subjects: { subjectId: string; subjectName: string }[];
}

// The teaching-scope endpoint returns flat (class, subject) pairs, because that is what the create form
// needs — a teacher may hold Mathematics in 10A without holding Physics in 10A. A tree is this component's
// view of the same rows, so the grouping happens here rather than asking for a second shape from the API.
function groupByClass(scope: TeachingScope[]): ClassGroup[] {
  const byClass = new Map<string, ClassGroup>();

  for (const pair of scope) {
    const existing = byClass.get(pair.classId);

    if (existing) {
      existing.subjects.push({ subjectId: pair.subjectId, subjectName: pair.subjectName });
    } else {
      byClass.set(pair.classId, {
        classId: pair.classId,
        className: pair.className,
        classCode: pair.classCode,
        subjects: [{ subjectId: pair.subjectId, subjectName: pair.subjectName }],
      });
    }
  }

  return [...byClass.values()];
}

function TeacherClasses() {
  const { data, error } = useAsync(getTeachingScope);
  const searchParams = useSearchParams();
  const activeSubjectId = searchParams.get("subjectId");

  // Which classes are open. Seeded from the loaded data on first render rather than in an effect — every
  // class starts expanded, as asked, and a Set of the ones the teacher has since *closed* is what this
  // tracks. Storing the closed ones instead of the open ones is what makes "expanded by default" survive
  // the data arriving after the first paint, with no setState in an effect body (which the React Compiler
  // lint rule forbids anyway).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (classId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(classId)) next.add(classId);
      return next;
    });

  // Silent on failure. This is a navigation aid beside a nav list that already works; an error banner in the
  // sidebar chrome would be louder than what it is reporting.
  if (error) return null;

  const groups = data ? groupByClass(data.items) : null;

  return (
    <div>
      <SectionHeading>My classes</SectionHeading>

      {groups === null ? (
        <Quiet>Loading…</Quiet>
      ) : groups.length === 0 ? (
        // A real state, and worth naming: a teacher with no grants cannot create anything, and this is where
        // they find out why rather than from an empty picker on the new-assignment form.
        <Quiet>No classes assigned yet</Quiet>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {groups.map((group) => {
            const isOpen = !collapsed.has(group.classId);
            const Chevron = isOpen ? ChevronDown : ChevronRight;

            return (
              <li key={group.classId}>
                <button
                  type="button"
                  onClick={() => toggle(group.classId)}
                  aria-expanded={isOpen}
                  className={cn(ROW, "text-white/70 hover:bg-white/5 hover:text-white")}
                >
                  <Chevron aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{group.className}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                    {group.subjects.length}
                  </span>
                </button>

                {isOpen && (
                  // The left rule is on the group, not on each subject — one continuous line down the
                  // subjects rather than a broken dash beside each.
                  <ul className="ml-5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                    {group.subjects.map((subject) => {
                      const isActive = activeSubjectId === subject.subjectId;

                      return (
                        <li key={subject.subjectId}>
                          <Link
                            href={`/teacher/assignments?classId=${group.classId}&subjectId=${subject.subjectId}`}
                            aria-current={isActive ? "true" : undefined}
                            className={cn(
                              ROW,
                              "py-1.5 text-xs",
                              isActive
                                ? "bg-white/10 text-white"
                                : "text-white/60 hover:bg-white/5 hover:text-white",
                            )}
                          >
                            <span className="truncate">{subject.subjectName}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- Student -------------------------------------------------------------------------------------

function StudentClasses() {
  const { data, error } = useAsync(listMyClasses);
  const pathname = usePathname();

  if (error) return null;

  const classes = data?.items ?? null;

  return (
    <div>
      {/* Singular or plural from the data. The brief assumed one class per student; the schema does not, and
          the seed data has a student in two — so the heading follows the rows rather than the assumption. */}
      <SectionHeading>{classes && classes.length === 1 ? "My class" : "My classes"}</SectionHeading>

      {classes === null ? (
        <Quiet>Loading…</Quiet>
      ) : classes.length === 0 ? (
        <Quiet>Not enrolled yet</Quiet>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {classes.map((enrolled) => (
            <li key={enrolled.classId}>
              <div className={cn(ROW, "gap-2 text-sm text-white/70")}>
                <GraduationCap aria-hidden="true" className="size-3.5 shrink-0 text-white/40" />
                <span className="min-w-0 flex-1 truncate">{enrolled.className}</span>
                <span className="shrink-0 text-[11px] text-white/40">{enrolled.classCode}</span>
              </div>

              {/* A page, not a modal. It is deep-linkable, it needs no dialog infrastructure this app does
                  not have, and on a phone a full page beats a sheet for a list that can run to thirty names. */}
              <Link
                href={`/student/classmates/${enrolled.classId}`}
                aria-current={
                  pathname === `/student/classmates/${enrolled.classId}` ? "page" : undefined
                }
                className={cn(
                  ROW,
                  "ml-5 w-auto border-l border-white/10 py-1.5 pl-2 text-xs",
                  pathname === `/student/classmates/${enrolled.classId}`
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Users aria-hidden="true" className="size-3.5 shrink-0" />
                View classmates
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Entry point ---------------------------------------------------------------------------------

// Admin gets nothing here on purpose: they hold no teaching scope and no enrolment, and they already reach
// every class through /admin/classes. A section reading "no classes" would be noise, not information.
export function SidebarClasses({ role }: { role: string }) {
  if (role === "Teacher") return <TeacherClasses />;
  if (role === "Student") return <StudentClasses />;
  return null;
}
