# Build Roadmap — Phase Status

Tracks the 22 phases against what's implemented **on this branch**. Each
`phase-N` branch in this repository is a checkpoint: check one out, `npm
install`, `docker compose up -d`, run migrations, and you have a fully
working app for that point in the project — nothing missing, nothing half-built.

Legend: ✅ Implemented on this branch · 🧱 Schema ready, module not built yet · ⏳ Not started

| Phase | Name                        | Status | Notes |
|------:|-----------------------------|:------:|-------|
| 1     | Authentication              | ✅ | Register, login, JWT access tokens, rotating refresh tokens with theft detection, account lockout, email verification (stubbed email delivery). |
| 2     | Organizations                | ✅ | Create/list/read/update/soft-delete organizations. Authorization is ownership-only (`organization.ownerId`). |
| 3     | Memberships                   | ✅ | You are here. Org creation now also creates the owner's `ACTIVE` membership (transactional). Owner can list/add(by email)/suspend/remove members. Still ownership-only authorization. |
| 4     | Roles                         | ⏳ | Next branch: `phase-4`. |
| 5     | Permission Engine             | ⏳ | |
| 6     | Permission Caching            | ⏳ | |
| 7     | Resource Authorization         | ⏳ | |
| 8     | Invitations                    | ⏳ | |
| 9     | Session Management              | ⏳ | |
| 10    | Audit Logs                      | ⏳ | |
| 11    | Security                        | 🧱 | Baseline only: `helmet()`, global `ValidationPipe`, a basic global rate limit. Full phase adds per-route limits and more hardening. |
| 12    | API Keys                        | ⏳ | |
| 13    | Password Reset                   | ⏳ | |
| 14    | Admin Features                   | ⏳ | |
| 15    | Request Tracking                  | ⏳ | |
| 16    | Structured Errors                 | ⏳ | |
| 17    | Event-Driven Architecture          | ⏳ | |
| 18    | Database Transactions              | 🧱 | Pattern already used inside `AuthService` (refresh rotation, email verification) — expands as more multi-write workflows are added. |
| 19    | Redis (general)                    | ⏳ | |
| 20    | API Documentation (Swagger)         | ⏳ | |
| 21    | Docker                              | 🧱 | `docker-compose.yml` (Postgres + Redis) and a `Dockerfile` for the app exist; Redis isn't used by app code until Phase 6. |
| 22    | Logging & Observability             | ⏳ | |

## A note on the database schema

`prisma/schema.prisma` was designed **up front** to cover all 22 phases (see
[`docs/DATABASE.md`](./DATABASE.md)) — this is common practice in real
projects: you sketch the full data model before building features
incrementally on top of it. What changes phase to phase is **which modules
are wired into `app.module.ts`** and **which tables those modules actually
read/write** — not the schema itself. Tables like `Organization`, `Role`, or
`ApiKey` already exist in the database on this branch, but no code uses them
yet.

## What's next: Phase 4 — Roles

- `Role`, `Permission`, `RolePermission`, and `MembershipRole` models already
  exist in the schema.
- Seed script (`prisma/seed.ts`) introduces the permission catalog and
  built-in system roles (OWNER, ADMIN, MEMBER).
- `RolesModule` adds CRUD for organization-specific custom roles, and
  endpoints to assign/unassign a role on a membership.
- Authorization for role management is **still ownership-only** (only the
  org owner can manage roles) — Phase 5 is what actually makes roles affect
  *authorization decisions* elsewhere in the API.
