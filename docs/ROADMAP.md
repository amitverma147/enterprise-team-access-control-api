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
| 3     | Memberships                   | ✅ | Org creation now also creates the owner's `ACTIVE` membership (transactional). Owner can list/add(by email)/suspend/remove members. Still ownership-only authorization. |
| 4     | Roles                         | ✅ | Seeded system roles (OWNER/ADMIN/MEMBER) + full permission catalog. Custom role CRUD and role assignment on memberships. |
| 5     | Permission Engine             | ✅ | Global `PermissionsGuard` + `@RequirePermissions(...)`. Organizations/Memberships/Roles fully switched from ownership checks to permission checks. New members get the system MEMBER role by default. |
| 6     | Permission Caching            | ✅ | `PermissionsService.resolveMembership()` is Redis-cached (5 min TTL) with explicit invalidation on every write that could change a membership's effective permissions. |
| 7     | Resource Authorization         | ✅ | Ownership rules that a generic permission can't express: the org owner cannot be suspended/removed, and their OWNER role assignment cannot be stripped — even by an ADMIN with the matching permission. Automated e2e tests (`test/tenant-isolation.e2e-spec.ts`) cover cross-tenant isolation + these rules. |
| 8     | Invitations                    | ✅ | You are here. One-time hashed tokens (same pattern as email verification/refresh tokens), works for people without an account yet, email-match enforced on accept, auto-expiry. |
| 9     | Session Management              | ⏳ | Next branch: `phase-9`. |
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
| 21    | Docker                              | 🧱 | `docker-compose.yml` (Postgres + Redis) and a `Dockerfile` for the app exist; the app itself isn't containerized in `docker-compose.yml` yet (runs on the host against the two containers). |
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

## What's next: Phase 9 — Session Management

- `Session` rows already exist (created/rotated by `AuthService` since
  Phase 1) but there's no way for a user to see or revoke them yet.
- `SessionsModule` adds `GET /auth/sessions` (list the caller's own
  sessions: device/IP metadata, last active time) and
  `DELETE /auth/sessions/:sessionId` (revoke a session, which also revokes
  its underlying refresh token — the next `/auth/refresh` with that token
  fails immediately).

Run `npm run prisma:seed` before trying this branch if you haven't already
— the permission engine depends on the system roles it creates. Also run
`npm run docker:up` to start Postgres + Redis.
