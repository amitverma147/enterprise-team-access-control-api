# Enterprise Team Access Control API

A production-oriented NestJS backend for authentication, RBAC, multi-tenancy,
and secure API design — built **phase by phase**, each phase on its own git
branch (`phase-1`, `phase-2`, ... `phase-22`), so you can check out any
branch and run a fully working, testable slice of the system.

> **You are on: `phase-6` — Permission Caching.**
> New here? Start with [`docs/SYSTEM_DESIGN.md`](./docs/SYSTEM_DESIGN.md) for
> the target architecture, [`docs/ARCHITECTURE_MINDMAP.md`](./docs/ARCHITECTURE_MINDMAP.md)
> for a visual map, and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for exactly
> what's built on this branch vs. planned.

## Stack

- **NestJS** (TypeScript) — application framework
- **PostgreSQL** + **Prisma ORM** — system of record
- **Redis** — permission caching
- **JWT** (access) + rotating opaque tokens (refresh) — authentication
- **Argon2id** — password hashing
- **Docker Compose** — local Postgres + Redis

## What's built on this branch (Phases 1–6)

**Phase 1 — Authentication**
- `POST /auth/register` — create an account (Argon2id password hashing),
  auto-issues tokens, and creates a hashed email verification token.
- `POST /auth/login` — verifies credentials, enforces **account lockout**
  after repeated failed attempts.
- `POST /auth/refresh` — **rotating** refresh tokens: every use invalidates
  the old token and issues a new one in the same "family"; replaying an
  already-used token revokes the whole family (theft detection).
- `POST /auth/logout` — revokes a refresh token/session.
- `POST /auth/verify-email` — consumes a one-time email verification token.
- Global security baseline: `helmet()`, input validation (`class-validator`),
  a basic rate limit, and "secure by default" route protection
  (`JwtAuthGuard` + `@Public()`).

**Phase 2 — Organizations**
- `POST /organizations` — create an organization (you become its owner).
- `GET /organizations` — list organizations you own.
- `GET/PATCH/DELETE /organizations/:organizationId` — read/update/soft-delete,
  restricted to the organization's owner (`ownerId`).
- Authorization is **intentionally ownership-only** at this phase — there's
  no Role/Permission system yet (Phases 4–5 add that, and Phase 5 replaces
  these checks with a real permission engine).

**Phase 3 — Memberships**
- Creating an organization now also creates the owner's `ACTIVE` membership,
  in the same database transaction.
- `GET /organizations/:organizationId/members` — list members (owner only).
- `POST /organizations/:organizationId/members` — add an *existing* user to
  the org by email (owner only). Invite-by-token for people without an
  account yet is Phase 8.
- `PATCH .../members/:membershipId` — suspend/reactivate a member (owner only).
- `DELETE .../members/:membershipId` — remove a member (owner only; the
  owner cannot remove themself).

**Phase 4 — Roles**
- `npm run prisma:seed` seeds the full permission catalog and three built-in
  system roles: `OWNER`, `ADMIN`, `MEMBER`.
- `GET/POST/PATCH/DELETE /organizations/:organizationId/roles` — CRUD for
  organization-specific custom roles (owner only). System roles cannot be
  modified/deleted via the API.
- `POST/DELETE .../members/:membershipId/roles/:roleId` — assign/unassign a
  role on a membership (owner only).
- Roles are assignable and the data model works, but nothing enforces them
  yet — that's this phase's job.

**Phase 5 — Permission Engine**
- `PermissionsGuard`, registered globally: for any route with an
  `:organizationId` param, confirms the caller has an **ACTIVE** membership,
  and (where `@RequirePermissions(...)` is present) the specific
  permission(s) required.
- `Organizations`, `Memberships`, and `Roles` controllers/services **no
  longer use ownership checks** — compare this branch's `organizations.service.ts`
  to `phase-4`'s to see the simplification. Authorization is now entirely
  data-driven: an ADMIN can do admin things without being the literal
  `ownerId`.
- Creating an organization now assigns the creator the system `OWNER` role;
  adding a member now assigns them the system `MEMBER` role by default.
- Try it: register two users, have one create an org and add the other as a
  member, then confirm the member can list members (`members:read`) but
  cannot create custom roles or delete the org (`roles:manage` /
  `org:delete` are ADMIN/OWNER-only).

**Phase 6 — Permission Caching**
- `PermissionsService.resolveMembership(...)` now checks Redis before
  Postgres, caching the resolved membership + permission set for 5 minutes.
- Every write that could change a membership's effective permissions
  (status change, role assignment/unassignment, a role's permission set
  changing) explicitly invalidates the relevant cache entries — try
  suspending a member and immediately re-requesting as them: you get an
  instant 403, not a stale cached 200.

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for what's coming in `phase-7`
onward — each subsequent branch adds one phase without breaking earlier ones.

## Getting started

### 1. Prerequisites
- Node.js 20+
- Docker (for local Postgres)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```

### 4. Start infrastructure
```bash
npm run docker:up      # starts Postgres (5432) and Redis (6380 on host)
```

### 5. Set up the database
```bash
npm run prisma:migrate
npm run prisma:seed      # seeds system roles + permission catalog
```

### 6. Run the app
```bash
npm run start:dev
# API available at http://localhost:3000/api/v1
```

### 7. Try it
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SuperSecret123!","fullName":"You"}'
```

## Scripts

| Command                 | Purpose                                             |
|--------------------------|------------------------------------------------------|
| `npm run start:dev`      | Run the API in watch mode                            |
| `npm run build`          | Compile TypeScript to `dist/`                        |
| `npm run test`           | Unit tests                                           |
| `npm run test:e2e`       | End-to-end tests                                     |
| `npm run docker:up`      | Start Postgres + Redis via Docker                     |
| `npm run docker:down`    | Stop Docker Compose services                         |
| `npm run prisma:migrate` | Create/apply a Prisma migration                      |
| `npm run prisma:generate`| Regenerate the Prisma client                         |
| `npm run prisma:studio`  | Open Prisma Studio (visual DB browser)               |

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/SYSTEM_DESIGN.md`](./docs/SYSTEM_DESIGN.md) | Target architecture, request lifecycle, security design for the *whole* project |
| [`docs/ARCHITECTURE_MINDMAP.md`](./docs/ARCHITECTURE_MINDMAP.md) | Visual mind maps of the whole project, module dependencies, and data model |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Entity-relationship diagram and table-by-table design rationale |
| [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) | File-by-file guide to `src/` |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | **Phase-by-phase status for THIS branch** and what the next branch adds |

Every source file also carries a `FILE PURPOSE` doc comment at the top
explaining what it does, why it's designed that way, and which phase it
belongs to.

## Branch map

| Branch | Adds |
|---|---|
| `phase-1` | Authentication |
| `phase-2` | Organizations |
| `phase-3` | Memberships |
| `phase-4` | Roles |
| `phase-5` | Permission Engine |
| `phase-6` (this branch) | Permission Caching (Redis) |
| `phase-7` → `phase-22` | See [`docs/ROADMAP.md`](./docs/ROADMAP.md) |

## Project layout

```
prisma/
  schema.prisma       # full data model (designed for all 22 phases up front)
src/
  config/             # typed configuration
  common/             # cross-cutting: Prisma, guards, decorators, types
  modules/
    auth/             # Phase 1
    organizations/    # Phase 2
    memberships/      # Phase 3
    roles/            # Phase 4
    permissions/      # Phase 5 & 6
docs/                 # architecture, database, roadmap, mind maps
docker-compose.yml    # local Postgres + Redis
```
