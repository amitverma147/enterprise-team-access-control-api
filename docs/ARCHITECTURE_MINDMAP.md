# Architecture Mind Map

> These diagrams show the **target design for the whole project**. Check
> [`ROADMAP.md`](./ROADMAP.md) on your current branch to see which parts
> already exist in code.

A birds-eye view of the whole project, meant to be skimmed before you go deep
into any one phase. Pair this with [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md)
(the "why") and [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) (the "where").

## 1. Whole-project mind map

```mermaid
mindmap
  root((Enterprise Team\nAccess Control API))
    Identity
      Authentication
        Argon2id password hashing
        JWT access tokens
        Rotating refresh tokens
        Account lockout
        Email verification
      Password Reset
        Reset tokens
        Password history
    Multi-Tenancy
      Organizations
        Ownership
        Soft delete
      Memberships
        Status lifecycle
        Many-to-many User <-> Org
      Invitations
        One-time tokens
        Expiration
    Authorization
      Roles
        System roles
        Custom roles
      Permission Engine
        Guards
        Decorators
        Permission catalog
      Permission Caching
        Redis
        Invalidation on write
      Resource Authorization
        Ownership checks
        Defense in depth
    Operability
      Sessions
        Device tracking
        Revocation
      Audit Logs
        Immutable events
        JSONB metadata
      Request Tracking
        Request IDs
        Tracing
      Structured Errors
        Error codes
        Consistent shape
      Logging and Observability
    Platform
      API Keys
        Machine to machine auth
        Scopes
      Admin Features
        Pagination
        Filtering and search
        Bulk operations
      Event-Driven Architecture
        Domain events
        Listeners
      Database Transactions
      Redis
      API Documentation
        OpenAPI and Swagger
      Docker
```

## 2. Module dependency mind map (what depends on what)

```mermaid
flowchart TB
    Config[Config Module] --> Prisma[Prisma Module]
    Config --> Redis[Redis Module]
    Prisma --> Auth[Auth Module]
    Auth --> Organizations[Organizations Module]
    Prisma --> Permissions[Permissions Module]
    Redis --> Permissions
    Permissions --> Organizations
    Permissions --> Memberships[Memberships Module]
    Permissions --> Roles[Roles Module]
    Organizations --> Memberships
    Organizations --> Roles
    Memberships --> Roles

    Roles --> Invitations[Invitations Module - planned]
    Auth --> Sessions[Sessions Module - planned]
    Organizations --> AuditLogs[Audit Log Module - planned]
    Organizations --> ApiKeys[API Keys Module - planned]
```

Read this bottom-up: `PermissionsModule` cannot exist without `PrismaModule`
and `RedisModule`; every feature module that enforces authorization
(`Organizations`, `Memberships`, `Roles`) depends on `PermissionsModule` for
its guard/service, not the other way around.

## 3. Data model mind map

```mermaid
mindmap
  root((Data Model))
    User
      RefreshToken
      EmailVerificationToken
      PasswordResetToken
      PasswordHistoryEntry
      Session
    Organization
      Membership
        MembershipRole
      Role
        RolePermission
      Invitation
      AuditLog
      ApiKey
    Permission
      RolePermission
```

See [`DATABASE.md`](./DATABASE.md) for the full entity-relationship
explanation, including why certain fields are nullable and why some
constraints are enforced in application code rather than the database.

## 4. How to use these diagrams while learning

1. Start at the **whole-project mind map** to see where a phase fits in the
   larger picture.
2. Open [`ROADMAP.md`](./ROADMAP.md) to see whether that phase is built yet
   and which files implement it.
3. Read the file-level doc comment at the top of each relevant file — every
   file in `src/` has one explaining its purpose, design rationale, and which
   phase it belongs to.
4. Cross-reference the sequence diagram in `SYSTEM_DESIGN.md` §3 to see where
   in the request lifecycle that file's code actually runs.
