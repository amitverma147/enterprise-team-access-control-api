# Project Structure — File-by-File Guide (Phase 8)

This document is accurate to **this branch only** (`phase-8`) — it lists the
files that actually exist right now. Each phase branch updates this file to
add the new files introduced by that phase. For the eventual full structure,
see [`ARCHITECTURE_MINDMAP.md`](./ARCHITECTURE_MINDMAP.md) (target design).

```mermaid
mindmap
  root((src/))
    main.ts
    app.module.ts
    app.controller.ts
    app.service.ts
    config
      configuration.ts
    common
      prisma
        prisma.module.ts
        prisma.service.ts
      redis
        redis.module.ts
        redis.service.ts
      guards
        jwt-auth.guard.ts
        permissions.guard.ts
      decorators
        public.decorator.ts
        current-user.decorator.ts
        current-membership.decorator.ts
      types
        express.d.ts
    modules
      auth
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        hashing.service.ts
        strategies/jwt.strategy.ts
        dto
      organizations
        organizations.module.ts
        organizations.controller.ts
        organizations.service.ts
        dto
      memberships
        memberships.module.ts
        memberships.controller.ts
        memberships.service.ts
        dto
      roles
        roles.module.ts
        roles.controller.ts
        roles.service.ts
        dto
      permissions
        permissions.module.ts
        permissions.service.ts
        decorators/require-permissions.decorator.ts
```

## Directory-by-directory explanation

### `src/main.ts`
Application bootstrap: security headers (`helmet`), CORS, global
`ValidationPipe`, and the global API prefix (`/api/v1`).

### `src/app.module.ts`
The composition root. On this branch: `ConfigModule`, `ThrottlerModule`,
`PrismaModule`, and `AuthModule`, with two global guards running on every
request: `JwtAuthGuard` → `ThrottlerGuard`.

### `src/config/configuration.ts`
One typed object describing every environment-driven setting the app uses.
Everything reads config through `ConfigService.get(...)` instead of touching
`process.env` directly.

### `src/common/prisma/`
- `prisma.service.ts` — injectable wrapper around `PrismaClient` with
  connect/disconnect lifecycle hooks.
- `prisma.module.ts` — makes `PrismaService` available everywhere via
  `@Global()`.

### `src/common/redis/`
- `redis.service.ts` — thin `ioredis` wrapper with JSON get/set helpers and
  prefix-based bulk deletion.
- `redis.module.ts` — global module, same rationale as Prisma's.

### `src/common/guards/`
- `jwt-auth.guard.ts` — validates the access token on every request unless
  the route is `@Public()`. "Secure by default."
- `permissions.guard.ts` — for any route with an `:organizationId` param,
  confirms active membership and (`@RequirePermissions(...)`) specific
  permissions. Attaches `request.membership` for downstream use.

### `src/common/decorators/`
- `public.decorator.ts` — opts a route out of the global `JwtAuthGuard`.
- `current-user.decorator.ts` — pulls the authenticated user (`sub`, `email`)
  off `request.user`.
- `current-membership.decorator.ts` — pulls the resolved membership +
  permission list off `request.membership`, set by `PermissionsGuard`.

### `src/common/types/express.d.ts`
Augments Express's `Request.user` type (via `Express.User`) so
`request.user` is properly typed everywhere, instead of `any`.

### `src/modules/auth/` — Phase 1 (Authentication)
- `auth.module.ts` — wires Passport + JWT signing + the controller/service.
- `auth.controller.ts` — `/auth/register`, `/login`, `/refresh`, `/logout`,
  `/verify-email`. All `@Public()`.
- `auth.service.ts` — registration, credential checks, account lockout,
  refresh token rotation + theft detection, email verification.
- `hashing.service.ts` — Argon2id for passwords, SHA-256 for opaque tokens.
- `strategies/jwt.strategy.ts` — Passport strategy that verifies the access
  token's signature/expiry and populates `request.user`.
- `dto/` — `class-validator`-annotated request bodies for each endpoint.

### `src/modules/organizations/` — Phase 2 (Organizations)
- `organizations.service.ts` — create/list/read/update/soft-delete, with
  ownership checks inline (see the file's header comment for why this is
  intentionally simple at this phase, and how it evolves in Phase 5).
- `organizations.controller.ts` — routes, all behind the global
  `JwtAuthGuard`.
- `dto/` — `class-validator`-annotated request bodies.

### `src/modules/memberships/` — Phase 3 (Memberships)
- `memberships.service.ts` — list/add/suspend/remove members; every method
  reuses `OrganizationsService.assertOwner(...)` for its authorization check.
- `memberships.controller.ts` — nested under `/organizations/:organizationId/members`.
- `dto/` — `AddMemberDto` (add an existing user by email), `UpdateMembershipDto`.

### `src/modules/roles/` — Phase 4 (Roles)
- `roles.service.ts` — list system + custom roles, create/update/delete
  custom roles, assign/unassign a role on a membership.
- `roles.controller.ts` — nested under `/organizations/:organizationId`,
  authorized via `@RequirePermissions('roles:read' | 'roles:manage' | 'roles:assign')`.
- `dto/` — `CreateRoleDto`, `UpdateRoleDto`.

### `src/modules/permissions/` — Phase 5 & 6 (Permission Engine + Caching)
- `permissions.service.ts` — resolves a membership's status + effective
  permission set (union across all assigned roles), with Redis caching and
  targeted invalidation helpers (`invalidate`, `invalidateForRole`).
- `decorators/require-permissions.decorator.ts` — declares which
  permissions a route requires; read by `PermissionsGuard`.

### `prisma/seed.ts`
Seeds the permission catalog and the three built-in system roles (OWNER,
ADMIN, MEMBER). Run with `npm run prisma:seed`.

### `src/modules/invitations/` — Phase 8 (Invitations)
- `invitations.service.ts` — create/list/revoke invitations; `accept()`
  verifies token hash + expiry + email match, then creates a Membership and
  assigns the invited role in one transaction.
- `invitations.controller.ts` — management routes nested under an org
  (permission-guarded); `accept` is top-level (any authenticated user).
- `dto/` — `CreateInvitationDto`, `AcceptInvitationDto`.

### `test/tenant-isolation.e2e-spec.ts` — Phase 7 (Resource Authorization)
Automated coverage, against the real database, for: cross-tenant 403s, a
MEMBER's restricted access, and the two ownership-protection rules added
this phase (owner can't be suspended/removed; owner's OWNER role can't be
unassigned).

### `prisma/schema.prisma`
The full data model for all 22 phases (see [`DATABASE.md`](./DATABASE.md)).
At this phase, every table except `PasswordResetToken`, `PasswordHistoryEntry`,
`Invitation`, `Session`, `AuditLog`, and `ApiKey` is in active use.

---

For the *why* behind these files' relationships, see
[`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md). For what's next, see
[`ROADMAP.md`](./ROADMAP.md).
