import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ⚠️ THIS IS UX ONLY. It stops a student from *seeing* a teacher's screen; it does not protect any
// data. Every request the resulting page makes is authorised again by [Authorize] on the backend,
// which is the only thing that actually enforces rules 3, 4, 6 and 7. A user who edits the cookie
// below gets a broken-looking page full of 403s, not access to anything.
//
// Three deliberate departures from docs/07:
//
// 1. File and function name. Next 16 deprecated the `middleware` convention and renamed it to
//    `proxy` — `next dev` warns on a `middleware.ts` and the old name is slated for removal. Same
//    execution model, so this is a rename, not a rewrite. It must sit at the project root or in
//    `src/`, alongside `app/`; docs/07 puts it at `app/middleware.ts`, where Next treats it as an
//    ordinary module and never runs it, leaving route protection silently dead.
//
// 2. What it reads. docs/07's version reads an `accessToken` cookie, but the documented token
//    strategy in the same file puts tokens in localStorage, which this cannot see (it runs on the
//    server, before any JS). So auth.ts mirrors just the *role* into a readable cookie and this
//    checks that. The token itself stays out of cookies: putting a JWT in a JS-readable cookie adds
//    CSRF surface for no gain, since localStorage is already the storage of record.
//
// 3. Role areas are real URL segments (/admin, /teacher, /student), not Next route groups. A group
//    like `(admin)` is stripped from the URL, so the prefix check below could never match one.

const ROLE_COOKIE = "role";

// Path prefix → the role allowed to see it.
const ROLE_AREAS: Record<string, string> = {
  "/admin": "Admin",
  "/teacher": "Teacher",
  "/student": "Student",
};

const DASHBOARDS: Record<string, string> = {
  Admin: "/admin/dashboard",
  Teacher: "/teacher/dashboard",
  Student: "/student/dashboard",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  const isLoginPage = pathname === "/login";

  // No session: everything funnels to /login. The exception matters — redirecting /login to itself
  // is an infinite loop that Next surfaces as ERR_TOO_MANY_REDIRECTS.
  if (!role) {
    return isLoginPage ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  // Already signed in and visiting /login: send them to their own dashboard rather than showing a
  // form that would immediately redirect after submission.
  if (isLoginPage) {
    return NextResponse.redirect(new URL(DASHBOARDS[role] ?? "/", request.url));
  }

  // Wrong area for this role → their own dashboard, not /login. Bouncing a signed-in user to a login
  // form looks like the session broke.
  for (const [prefix, requiredRole] of Object.entries(ROLE_AREAS)) {
    if (pathname.startsWith(prefix) && role !== requiredRole) {
      return NextResponse.redirect(new URL(DASHBOARDS[role] ?? "/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Excludes Next's internals and static assets. Without the exclusions this would run on every
  // chunk and image request, redirecting them to /login and breaking the page it just rendered.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
