"use client";

import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { listMyClasses } from "@/lib/classes";

// Which classes the signed-in student is enrolled in, as a line of chips under the greeting.
//
// It owns its own fetch rather than taking the data as a prop, because it answers a question none of the
// other dashboard data does. Every number on that page is derived from the *assignment* list, and a class
// with nothing published in it yet contributes no assignments — so a student enrolled in two classes with
// work in only one would be told they are in one class. Enrolment is the only source that gets this right,
// which is why it is a separate call rather than something read off the cards.
//
// tone="neutral" and not accent: the subject chips on the cards below are already indigo, and two indigo
// chip families on one screen stop distinguishing anything.
export function EnrolledClasses() {
  const { data, error, loading } = useAsync(listMyClasses);

  if (loading) {
    return <Skeleton className="h-6 w-48" />;
  }

  // Silent on failure, deliberately. This is one line of context on a page whose real content is the
  // assignment list, and that list has its own Alert — a second error banner for the subtitle of a
  // heading would be louder than what it is reporting.
  if (error || !data) {
    return null;
  }

  const classes = data.items;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <GraduationCap aria-hidden="true" className="size-4 shrink-0" />
        {classes.length === 0
          ? "Not enrolled in a class yet"
          : classes.length === 1
            ? "Class"
            : "Classes"}
      </span>

      {classes.map((enrolled) => (
        <Badge key={enrolled.classId}>
          {enrolled.className}
          {/* The code as well as the name. "Class 10 - A" and "Class 10 - B" differ by one character at
              the end of a long string; "10A" and "10B" are what a student actually calls them. */}
          <span className="text-gray-400 dark:text-gray-500">· {enrolled.classCode}</span>
        </Badge>
      ))}
    </div>
  );
}
