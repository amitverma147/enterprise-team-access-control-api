# Project Structure — File-by-File Guide (Phase 1)

This document is accurate to **this branch only** (`phase-1`) — it lists the
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
      guards
        jwt-auth.guard.ts
      decorators
        public.decorator.ts
        current-user.decorator.ts
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

### `src/common/guards/jwt-auth.guard.ts`
Validates the access token on every request unless the route is
`@Public()`. "Secure by default."

### `src/common/decorators/`
- `public.decorator.ts` — opts a route out of the global `JwtAuthGuard`.
- `current-user.decorator.ts` — pulls the authenticated user (`sub`, `email`)
  off `request.user`.

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

### `prisma/schema.prisma`
The full data model for all 22 phases (see [`DATABASE.md`](./DATABASE.md)) —
only the `User`, `RefreshToken`, and `EmailVerificationToken` tables are used
by application code on this branch.

---

For the *why* behind these files' relationships, see
[`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md). For what's next, see
[`ROADMAP.md`](./ROADMAP.md).
