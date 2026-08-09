# CLAUDE.md

Read `.agent/memory/MEMORY.md` first, then `.agent/memory/AGENT_GUIDE.md`.
Fetch docs from `docs/` only as needed for the current task.
This root file is intentionally short — all detail lives in the memory + docs layer.

---

## Quick orientation

- **What:** Role-based Assignment & Submission Management System (recruitment project)
- **Deadline:** 14 August 2026
- **Runtime:** .NET **9** (`dotnet 9.0.308`) — target `net9.0`. Never use .NET 10 features.
- **Stack:** ASP.NET Core 9 + PostgreSQL + Next.js 16 + TypeScript

## Memory system

```
.agent/memory/
  MEMORY.md        ← READ FIRST — navigation index, per-file guide, current phase state
  AGENT_GUIDE.md   ← READ SECOND — 5-minute orientation, phase plan, standing constraints

docs/
  01_architecture.md        ← folder layout, dependency graph, design patterns
  02_domain_and_database.md ← entities, EF Core, migrations, seed data
  03_auth.md                ← JWT, refresh tokens, role claims, BCrypt
  04_api_design.md          ← all endpoints, DTOs, error shapes, pagination
  05_business_rules.md      ← THE MOST IMPORTANT FILE — 8 rules + test cases
  06_testing_guide.md       ← xUnit + Moq strategy, naming, coverage
  07_frontend.md            ← Next.js structure, API client, Zod schemas
  08_devops.md              ← Docker Compose, CI, environment vars
  09_explanation_log.md     ← narrative learning log, updated each phase
```

## Non-negotiable constraints

- Target `net9.0` in every `.csproj`
- PostgreSQL only (no SQLite except test doubles)
- JWT auth (no cookies, no third-party providers)
- Role enforcement in the **backend** — never trust the frontend
- No secrets in git — `.env` gitignored, `.env.example` committed
- All list endpoints paginated
- `Result<T>` for service returns — no throwing for expected failures
- Comments explain *why*, never restate the code
