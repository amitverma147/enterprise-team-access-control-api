# Build Roadmap — Phase Status

Tracks the 22 phases against what's implemented **on this branch**. Each
`phase-N` branch in this repository is a checkpoint: check one out, `npm
install`, `docker compose up -d`, run migrations, and you have a fully
working app for that point in the project — nothing missing, nothing half-built.

Legend: ✅ Implemented on this branch · 🧱 Schema ready, module not built yet · ⏳ Not started

| Phase | Name                        | Status | Notes |
|------:|-----------------------------|:------:|-------|
| 1     | Authentication              | ✅ | You are here. Register, login, JWT access tokens, rotating refresh tokens with theft detection, account lockout, email verification (stubbed email delivery). |
| 2     | Organizations                | ⏳ | Next branch: `phase-2`. |
| 3     | Memberships                   | ⏳ | |
| 4     | Roles                         | ⏳ | |
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

## What's next: Phase 2 — Organizations

- `Organization` model already exists in the schema.
- Add `OrganizationsModule` with create/list/read/update/soft-delete.
- Authorization at this stage is **intentionally simple**: only the
  organization's `ownerId` may update/delete it. There is no membership or
  role system yet — that's Phases 3–5. This mirrors how you'd actually build
  this incrementally: ship the tenant boundary first, layer richer
  authorization on top once more concepts exist.
