# Assignment & Submission Management System

A role-based web application where teachers publish assignments, students submit answers, and both
are held to a strict set of deadline, scoping and grading rules enforced on the server.

Built as a recruitment exercise for OnnoRokom Projukti Ltd.

```bash
git clone https://github.com/kaizen2112/Assignment-Submission-System.git
cd Assignment-Submission-System
docker compose up --build
```

Then open **http://localhost:3000** and sign in with any account from
[Demo Credentials](#demo-credentials). No `.env` file, no database setup, no migration step.

---

## Overview

Three roles, each with a genuinely different view of the same data:

| Role | Can do |
|---|---|
| **Admin** | Manage users, classes, subjects, teacher assignments and student enrolments; view every assignment and submission in the system |
| **Teacher** | Create, edit, publish and delete assignments **for the class + subject pairs they are assigned to**; see submissions for their own assignments; award marks and feedback |
| **Student** | See **published** assignments for the classes they are enrolled in; submit one text answer per assignment; edit it until the deadline or until it is graded; read their marks and feedback |

The interesting part of the project is not the CRUD — it is that **every rule is enforced in the
backend service layer**, and the frontend is treated as untrusted. Hiding a button is presentation;
returning `403` (or `404`, see [A7](#assumptions)) is security. Both are done, independently.

### Main features

- **JWT authentication** with short-lived access tokens (15 min) and rotating single-use refresh
  tokens (7 days). Logout revokes the refresh token server-side.
- **Role-based authorization** via `[Authorize(Roles = …)]`, verified by a reflection-based test suite
  that asserts every controller action carries the right guard.
- **Assignment lifecycle** — `Draft` → `Published`, with drafts invisible to students.
- **Deadline enforcement** with an opt-in per-assignment late-submission flag.
- **Grading** with marks validated against each assignment's own `MaxMarks`, plus written feedback.
- **A submission status state machine** that refuses invalid transitions, including un-grading.
- **Pagination on every list endpoint**, with an oversized `pageSize` rejected rather than clamped.
- **Consistent error shape** — one `ProblemDetails`-style body for validation failures, business-rule
  failures and framework model-binding failures alike.
- **Seeded demo data** on first boot: 6 users, 2 classes, 3 subjects, 3 assignments, 3 submissions,
  arranged so the scoping rules can be probed by hand.
- **Swagger UI** with a working **Authorize** button, so every endpoint can be exercised from a
  browser.
- **78 unit tests** covering all 8 business rules and the role guards.
- **One-command Docker setup** and **GitHub Actions CI** on every push.

---

## Technology Stack

### Backend

| Component | Version |
|---|---|
| .NET / ASP.NET Core | **9** (`net9.0`, built with SDK 9.0.308) |
| Entity Framework Core | 9.0.4 |
| Npgsql.EntityFrameworkCore.PostgreSQL | 9.0.4 |
| PostgreSQL | **16** (`postgres:16-alpine` in Docker) |
| Microsoft.AspNetCore.Authentication.JwtBearer | 9.0.11 |
| System.IdentityModel.Tokens.Jwt | 8.22.0 |
| FluentValidation.DependencyInjectionExtensions | 12.1.1 |
| Swashbuckle.AspNetCore | 7.2.0 |
| BCrypt.Net-Next | 4.0.3 (work factor 12) |

### Frontend

| Component | Version |
|---|---|
| Next.js | **16.3.0** (App Router, Turbopack) |
| React | 19.2.8 |
| TypeScript | 5.9.3 (strict, no `any`) |
| Tailwind CSS | 4.3.3 |
| react-hook-form | 7.85.0 |
| Zod | 4.4.3 |
| @hookform/resolvers | 5.7.1 |
| Node.js | **20.9 minimum** (Next 16's floor); developed on 24.19, Docker image uses `node:24-alpine` |

### Testing & tooling

| Component | Version |
|---|---|
| xUnit | 2.9.2 |
| Moq | 4.20.72 |
| FluentAssertions | 7.2.2 |
| coverlet.collector | 6.0.2 |
| dotnet-ef (local tool) | 9.0.4 |
| Docker Compose | v2 (`docker compose`, not `docker-compose`) |

> Versions are pinned deliberately. EF Core 10.x targets `net10.0`; Swashbuckle 10.x breaks the
> security-definition API; and `typescript@latest` is now the 7.x native rewrite. Do not unpin
> without checking.

---

## Architecture

Four backend projects in a one-way dependency chain — Clean Architecture, with the domain at the
centre knowing nothing about the outside.

```
Api  ──────────►  Application  ──────────►  Domain
 │                     ▲
 └──────────►  Infrastructure ──────────────┘

Api             controllers, middleware, filters, DI wiring, Swagger
Application     services (all business rules), DTOs, validators, repository interfaces
Infrastructure  EF Core DbContext, repositories, migrations, BCrypt, JWT, seeder
Domain          entities and enums — zero dependencies
```

`Application` declares the repository *interfaces*; `Infrastructure` implements them. That inversion
is what lets 78 tests run against `Moq` doubles with no database.

Services return `Result<T>` rather than throwing for expected failures, and controllers translate
that into HTTP through a single `ToProblemResult()` mapper — so status codes are decided in one place.

### Project structure

```
Assignment-Submission-System/
├── docker-compose.yml              # db + api + web, with health checks
├── docker-compose.override.yml     # local dev conveniences (auto-merged)
├── .env.example                    # every variable, all optional
├── .github/workflows/ci.yml        # tests + typecheck + lint + build on push
│
├── Backend/
│   ├── AssignmentSystem.sln
│   ├── Dockerfile                  # sdk:9.0 build → aspnet:9.0 runtime
│   ├── .config/dotnet-tools.json   # dotnet-ef 9.0.4
│   ├── src/
│   │   ├── Domain/
│   │   │   ├── Entities/           # User, Class, Subject, Assignment, Submission,
│   │   │   │                       # TeacherAssignment, StudentEnrollment, RefreshToken
│   │   │   └── Enums/              # Role, AssignmentStatus, SubmissionStatus
│   │   ├── Application/
│   │   │   ├── Common/             # Result<T>, ErrorType, PagedResult
│   │   │   ├── DTOs/               # Auth, Assignment, Submission, Admin, Common
│   │   │   ├── Interfaces/         # repository + service contracts
│   │   │   ├── Services/           # AuthService, AssignmentService,
│   │   │   │                       # SubmissionService, AdminService
│   │   │   └── Validators/         # FluentValidation, one per request DTO
│   │   ├── Infrastructure/
│   │   │   ├── Auth/               # JwtService, BcryptPasswordHasher
│   │   │   ├── Persistence/        # AppDbContext + EntityConfigurations/
│   │   │   ├── Migrations/         # InitialCreate, AddRefreshTokens
│   │   │   ├── Repositories/       # 5 repositories
│   │   │   └── Seed/               # DataSeeder (idempotent)
│   │   └── Api/
│   │       ├── Controllers/        # Auth, Assignments, Submissions, Admin
│   │       ├── Filters/            # ValidationFilter (global)
│   │       ├── Middleware/         # ExceptionMiddleware
│   │       ├── Services/           # CurrentUserService
│   │       └── Program.cs          # DI, CORS, JWT, Swagger, migrate + seed, /health
│   └── tests/UnitTests/
│       ├── Services/               # AssignmentServiceTests, SubmissionServiceTests
│       ├── Authorization/          # RoleGuardTests (reflects over [Authorize])
│       └── Helpers/                # EntityBuilders, MockRepositoryHelper
│
└── Frontend/
    ├── Dockerfile                  # node build → standalone runtime
    ├── next.config.ts              # output: "standalone"
    └── src/
        ├── proxy.ts                # role-based route guard (Next 16 renamed middleware → proxy)
        ├── app/
        │   ├── (auth)/login/
        │   ├── admin/dashboard/
        │   ├── teacher/            # dashboard, assignments, new, [id]/edit,
        │   │                       # [id]/submissions, [id]/submissions/[submissionId]
        │   └── student/            # dashboard, assignments, assignments/[id], submissions
        ├── components/             # layout/, ui/, teacher/, student/
        ├── hooks/                  # useAsync, useHydrated
        ├── lib/                    # api client, auth, schemas, assignments, dashboard, utils
        └── types/                  # api.ts — response shapes
```

---

## Prerequisites

### To run with Docker — this is all you need

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (WSL 2 backend on Windows).
  Nothing else: no .NET SDK, no Node, no PostgreSQL.

On Windows, WSL 2 first if you do not already have it — `wsl --install` in an **administrator**
terminal, then reboot. Docker Desktop must be opened once so its engine starts; check for
**"Engine running"** in the bottom-left before running any `docker` command.

### To run manually instead

- **.NET SDK 9.0** — `dotnet --version` should report `9.0.x`
- **Node.js 20.9+** — developed on 24.19
- **PostgreSQL 16** listening on `localhost:5432`

---

## Getting Started

### Run with Docker

```bash
git clone https://github.com/kaizen2112/Assignment-Submission-System.git
cd Assignment-Submission-System
docker compose up --build
```

**No `.env` file is required.** Every variable has a working default inside `docker-compose.yml`. The
first build downloads ~1.5 GB of base images and takes a few minutes; later starts take seconds.

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:5000/api/v1 |
| **Swagger UI** | http://localhost:5000/swagger |
| Health check | http://localhost:5000/health |

The three containers start in dependency order, and the API waits for PostgreSQL to report *ready*
(not merely *listening*) before applying its migrations and seeding the demo data.

```bash
docker compose down          # stop; the database volume is kept
docker compose down -v       # stop and delete the data, so the next start re-seeds from scratch
docker compose logs -f api   # follow the API log
docker compose ps            # health status of all three services
```

If port 3000 or 5000 is taken, set `WEB_PORT` / `API_PORT` in a `.env` file — and see the note under
[Environment Variables](#environment-variables) about changing `NEXT_PUBLIC_API_URL` to match.

### Run Manually

With PostgreSQL 16 already running, in two terminals:

```bash
# terminal 1 — API on http://localhost:5274, Swagger at /swagger
cd Backend/src/Api
dotnet run
```

```bash
# terminal 2 — frontend on http://localhost:3000
cd Frontend
npm install
npm run dev
```

`dotnet run` picks up `Properties/launchSettings.json`, which sets
`ASPNETCORE_ENVIRONMENT=Development`. That matters: the Development environment is what applies
migrations, seeds the demo data and serves Swagger. Starting the app with `--no-launch-profile` skips
it and the app exits with *"connection string is not configured"*.

Connection string and JWT key for manual runs live in
`Backend/src/Api/appsettings.Development.json`.

> The frontend's default API base URL is `http://localhost:5274/api/v1`, which matches the manual
> setup. `Frontend/.env.local` can override it.

**A convenient hybrid** — database in Docker, both apps native, which is the fastest edit-reload loop
on Windows:

```bash
docker compose up db                        # container Postgres, published on host 5433
dotnet run --project Backend/src/Api
cd Frontend && npm run dev
```

---

## Database Setup and Migrations

Under Docker, and under a manual `dotnet run` in Development, **migrations are applied
automatically** at startup and the seeder runs afterwards. The seeder is idempotent — restarting
never duplicates or resets data. So for normal use there is nothing to do.

To drive migrations by hand, first restore the pinned EF tool:

```bash
cd Backend
dotnet tool restore          # installs dotnet-ef 9.0.4 from .config/dotnet-tools.json
```

Then, from the `Backend` directory:

```bash
# apply all pending migrations
dotnet ef database update --project src/Infrastructure --startup-project src/Api

# add a migration after changing an entity or configuration
dotnet ef migrations add <Name> --project src/Infrastructure --startup-project src/Api

# list migrations and their applied state
dotnet ef migrations list --project src/Infrastructure --startup-project src/Api

# roll back to a specific migration
dotnet ef database update <PreviousMigrationName> --project src/Infrastructure --startup-project src/Api

# inspect the SQL without executing it
dotnet ef migrations script --project src/Infrastructure --startup-project src/Api
```

`--project` is `Infrastructure` because that is where `AppDbContext` and the migrations live;
`--startup-project` is `Api` because that is where the connection string is configured.

Existing migrations: `InitialCreate` (all 7 domain tables) and `AddRefreshTokens`.

**To reset the database completely:**

```bash
docker compose down -v && docker compose up      # Docker
dotnet ef database drop --force --project src/Infrastructure --startup-project src/Api   # manual
```

---

## Running the Tests

```bash
cd Backend
dotnet test
```

**78 tests, all passing.** They are pure unit tests using Moq — **no database or running API is
required**, which is why CI needs no PostgreSQL service.

```bash
dotnet test --configuration Release            # exactly what CI runs
dotnet test --filter "FullyQualifiedName~SubmissionServiceTests"
dotnet test --collect:"XPlat Code Coverage"    # coverlet
```

| Test file | Covers |
|---|---|
| `Services/SubmissionServiceTests.cs` | Rules 1, 2, 3, 5, 8 — deadlines, update locks, mark bounds, status transitions |
| `Services/AssignmentServiceTests.cs` | Rules 3, 4, 6 — teacher scoping, draft visibility, class scoping, teaching scope |
| `Authorization/RoleGuardTests.cs` | Rule 7 — reflects over every controller action and asserts its `[Authorize]` attribute |

`RoleGuardTests` is the unusual one: rule 7 is enforced *only* by attributes, so a test that cannot
see the attributes cannot verify the rule. It reads them by reflection, which is why the test project
references `Api`.

The frontend is checked by CI with `npm run typecheck`, `npm run lint` and `npm run build`.

---

## API Reference

Base URL: `http://localhost:5000/api/v1` (Docker) or `http://localhost:5274/api/v1` (manual).

**Swagger UI: http://localhost:5000/swagger** — click **Authorize**, paste an `accessToken` from
`POST /auth/login` (the token only, without `Bearer `), and every protected endpoint becomes callable
from the browser.

28 endpoints across 4 controllers, plus `/health`.

### Auth — `/api/v1/auth`

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/login` | anonymous | Email + password → access token, refresh token, user |
| POST | `/refresh` | anonymous | Rotate a refresh token for a new pair (single-use) |
| POST | `/logout` | any | Revoke the refresh token server-side |
| GET | `/me` | any | The current user from the token's claims |

### Assignments — `/api/v1/assignments`

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/` | Teacher, Student | Paged list — teacher sees own, student sees published in their classes |
| GET | `/teaching-scope` | Teacher | The caller's own class + subject pairs, for the create form |
| GET | `/{id}` | Teacher, Student | Single assignment, scoped the same way |
| POST | `/` | Teacher | Create — always as `Draft` |
| PUT | `/{id}` | Teacher | Update own assignment (class and subject are immutable) |
| PATCH | `/{id}/publish` | Teacher | `Draft` → `Published` |
| DELETE | `/{id}` | Teacher | Delete own assignment if it has no submissions |

### Submissions — `/api/v1/assignments/{assignmentId}/submissions`

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/` | Teacher | Paged submissions for one of the caller's assignments |
| POST | `/` | Student | Submit an answer |
| GET | `/mine` | Student | The caller's own submission (404 = not submitted yet) |
| PUT | `/mine` | Student | Update own answer, before the deadline and before grading |
| PATCH | `/{submissionId}/grade` | Teacher | Award marks and feedback |
| PATCH | `/{submissionId}/status` | Teacher | Explicit status transition, validated against rule 8 |

### Admin — `/api/v1/admin`

All 11 are Admin-only; the `[Authorize(Roles = "Admin")]` attribute is on the **class**, so any
endpoint added later is Admin-only by default.

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | Paged users |
| POST | `/users` | Create a user in any role |
| PUT | `/users/{id}` | Update a user (including role changes) |
| DELETE | `/users/{id}` | Delete — refused with 409 if the user has academic records |
| GET | `/classes` | Paged classes with their subjects |
| POST | `/classes` | Create a class |
| POST | `/classes/{id}/subjects` | Add a subject to a class |
| POST | `/teacher-assignments` | Assign a teacher to a class + subject |
| POST | `/enrollments` | Enrol a student in a class |
| GET | `/assignments` | Every assignment, unscoped |
| GET | `/submissions` | Every submission, unscoped |

### Conventions

- **Pagination** — every list takes `?page=1&pageSize=20` and returns
  `{ items, page, pageSize, totalCount, totalPages }`. A `pageSize` over the maximum is **rejected
  with 400**, not silently clamped, so a caller is never quietly given different data than it asked
  for.
- **Errors** — one shape for everything: `400` validation, `401` missing/expired token, `403` wrong
  role, `404` not found *or not yours*, `409` conflict with an existing record or rule.
- **Timestamps** — always UTC. A deadline sent without an offset is read as UTC.

---

## Demo Credentials

Seeded automatically on first startup in the `Development` environment. The seeder is idempotent,
so restarting the app will not duplicate or reset this data.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.com` | `Admin@123` |
| Teacher | `teacher1@school.com` | `Teacher@123` |
| Teacher | `teacher2@school.com` | `Teacher@123` |
| Student | `student1@school.com` | `Student@123` |
| Student | `student2@school.com` | `Student@123` |
| Student | `student3@school.com` | `Student@123` |

Passwords are hashed with BCrypt at seed time — no plaintext password is ever stored.

The sample data is arranged so the role-scoping rules can be checked by hand:

- `teacher1` teaches Mathematics and English in **Class 10 - A**; `teacher2` teaches Science in
  **Class 10 - B**. `teacher2` reaching a Class 10 - A assignment must be refused.
- `student1` and `student2` are enrolled in **Class 10 - A**; `student3` in **Class 10 - B**, so
  Class 10 - A's assignments must be invisible to `student3`.
- Of the three assignments, two are **Published** and one is a **Draft** that no student should
  ever see. One published assignment's deadline has already passed with late submission refused;
  the other is still open and accepts late submissions.
- Of the three submissions, two are **graded with marks and feedback** and one is **pending**, so
  a teacher's grading queue is not empty on first login.

---

## Business Rules

Eight rules, all enforced in the **service layer** — never only in the UI, and never only in a
validator. Each has unit tests.

| # | Rule | Enforced in |
|---|---|---|
| 1 | **No submission after the deadline**, unless that assignment sets `AllowLateSubmission`. A late submission is stored with status `Late`. | `SubmissionService.SubmitAsync` |
| 2 | **No update after the deadline, or after grading.** Unlike rule 1, this has **no** late-submission exception. | `SubmissionService.UpdateMineAsync` |
| 3 | **Students see only their own data, scoped to their enrolled classes.** Another student's submission returns 404. | `AssignmentService`, `SubmissionService` |
| 4 | **A teacher is scoped to their assigned class + subject pairs.** Acting outside them is refused even for a class they can otherwise see. | `AssignmentService` create/update/delete, `SubmissionService.GradeAsync` |
| 5 | **Marks must be within `0 … MaxMarks`** of that specific assignment. Checked in the validator *and* the service. | `SubmissionService.GradeAsync` + `GradeSubmissionValidator` |
| 6 | **Draft assignments are invisible to students** — excluded from lists, and 404 by id. | `AssignmentService` student queries |
| 7 | **Role guards return 403, never an empty 200.** A student hitting a teacher endpoint is refused, not handed an empty array. | `[Authorize(Roles = …)]`, verified by `RoleGuardTests` |
| 8 | **Submission status transitions are validated** against a state machine. A graded submission cannot be un-graded. | `SubmissionService.ChangeStatusAsync` |

Rule 1 and rule 2 together produce a consequence worth stating: **`AllowLateSubmission` permits a
late *delivery*, not an open editing window.** A late submission is read-only the moment it is made —
rule 1 lets it in, rule 2 immediately locks it.

---

## Assumptions

The brief left these open. Each was resolved in the direction that keeps the system's guarantees
strict rather than convenient. A1–A7 are the assumptions recorded during design; A8–A13 emerged
while implementing.

| # | Assumption | Why |
|---|---|---|
| **A1** | **Grading permanently locks a submission** against further student edits. The student can read marks and feedback but cannot change the answer. | Otherwise a mark could end up attached to work that later changed. |
| **A2** | **Late submission is a per-assignment flag, defaulting to off.** | A global setting would let one lenient assignment loosen the deadline rule for every other one. |
| **A3** | **Submissions are text-only** — no file uploads. `AnswerText` is capped at 5000 characters. | Keeps the scope deliverable without weakening any graded rule. |
| **A4** | **One submission per student per assignment**, enforced by a unique database index rather than only in code. | Two rows for the same student would make "their submission" ambiguous, and grading non-deterministic. |
| **A5** | **An assignment with submissions cannot be deleted** — 409, not a cascade. Drafts have no submissions by definition, so they delete freely. | A cascade would destroy already-graded student work. |
| **A6** | **Admin sees everything but neither creates nor grades assignments.** Those are teacher actions, and no admin endpoint performs them. | Rule 4 ties authoring and grading to a teaching assignment; an admin has none. |
| **A7** | **A caller who may not see a resource gets 404, not 403.** | 403 confirms the resource exists. 404 gives nothing away — the same reasoning as a single generic login error. |
| **A8** | **An assignment is always created as a `Draft`.** Publishing is a separate, explicitly authorized transition. | A draft cannot become student-visible by accident. |
| **A9** | **Deleting a user who has academic records is refused, not cascaded.** Deleting a *class* does cascade through its subjects, assignments and submissions. | Removing a teacher who authored assignments, or a student who submitted work, would erase marks. |
| **A10** | **A deadline sent without a timezone offset is read as UTC.** `"2026-08-20T23:59:00"` and `"2026-08-20T23:59:00Z"` mean the same instant. | Rejecting the first would fail Swagger's own try-it-out payload for no real gain. All timestamps are stored and returned as UTC. |
| **A11** | **An overdue assignment stays editable, as long as the deadline is not changed.** A *new* deadline must be in the future. | A teacher can fix a typo in last week's homework, but back-dating a deadline would retroactively lock out students who still had time. |
| **A12** | **An assignment's class and subject are fixed once created** — `PUT` accepts neither field. | Moving it would re-scope it under students who had already submitted. Re-create instead. |
| **A13** | **A teacher sees only assignments they created**, in both the list and the single-item view; a colleague's returns 404. | Editing and grading are already restricted to your own work, so a broader read view would only expose other teachers' unpublished drafts. |

---

## Known Limitations

Stated plainly rather than hidden. None of these affect correctness of the eight rules; each is a
deliberate scope or time trade-off.

**Functional**

- **No Admin management UI.** All 11 admin endpoints exist and are tested, but the frontend gives
  Admin only a dashboard — user, class and enrolment management must be done through Swagger.
- **No file uploads** (A3), **no notifications**, **no password reset**, and no self-registration —
  accounts are created by an admin.

**Performance**

- **Two N+1 request fan-outs on the frontend.** The dashboards and "My submissions" page issue one
  request per assignment, because no aggregate-stats endpoint and no student-scoped
  `GET /submissions/mine` exist. With seed data that is 4 requests; with 100 assignments it is 101.
  The fix is two backend endpoints, not frontend batching.
- **"My submissions" paginates client-side** — the only list in the app that does — as a direct
  consequence of the missing endpoint above.
- **No caching layer and no client-side data cache.** Every navigation refetches. `IMemoryCache`
  server-side and TanStack Query client-side are the obvious additions.

**Robustness**

- **No optimistic concurrency.** Two teachers grading the same submission simultaneously produces
  last-write-wins with no warning. The fix is a `RowVersion` token mapped to a 409, which the error
  layer already supports.
- **No rate limiting on `/auth/login`.** BCrypt work factor 12 slows an attacker down, but it slows
  the server equally. ASP.NET Core's built-in `AddRateLimiter` is the fix.
- **No structured logging.** Default `ILogger` console output only; no Serilog, no correlation IDs.

**Testing**

- **Unit tests only** — 78 of them, with mocked repositories. There are no integration tests against
  a real database, so EF query translation and the migrations are exercised by running the app rather
  than by CI. The end-to-end flow was verified manually in a browser across all three roles.

**Operational**

- `ASPNETCORE_ENVIRONMENT=Development` inside the Docker image, deliberately — that is what applies
  migrations, seeds demo data and serves Swagger, which is what makes the setup one command. A real
  deployment would run Production, apply migrations as a separate step, and inject its own secrets.
- The credentials committed to this repository are **local-demo values, labelled as such**.
  `.env` is gitignored and no real secret is present anywhere in the repository or its history.

---

## License

No licence — submitted as a recruitment exercise for evaluation, not published for reuse.
