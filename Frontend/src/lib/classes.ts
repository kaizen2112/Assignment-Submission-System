import { api } from "@/lib/api";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/types/api";
import type { Classmate, EnrolledClass, PagedResult } from "@/types/api";

// The student-facing classes call. Separate from lib/admin.ts, which manages classes — this only reads
// which ones the caller is in, and the API takes no student id: it comes from the token.

// Asks for one full page rather than paging. A student is enrolled in a handful of classes and the header
// shows all of them, so a "next page" control would be a wider surface than the data behind it. MAX_PAGE_SIZE
// is the server's ceiling — anything above it is a 400, not a bigger page.
export const listMyClasses = (signal?: AbortSignal) =>
  api.get<PagedResult<EnrolledClass>>(
    "/classes/mine",
    { page: 1, pageSize: MAX_PAGE_SIZE },
    signal,
  );

// The roster of a class the caller is enrolled in. 404 for any other class — the API checks enrolment rather
// than trusting the id, so there is nothing to validate here.
export const listClassmates = (classId: string, page: number, signal?: AbortSignal) =>
  api.get<PagedResult<Classmate>>(
    `/classes/${classId}/classmates`,
    { page, pageSize: DEFAULT_PAGE_SIZE },
    signal,
  );
