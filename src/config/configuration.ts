/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Centralized, typed application configuration.
 *
 * Instead of reading `process.env.X` all over the codebase (easy to typo,
 * impossible to validate in one place), every module reads config through
 * Nest's `ConfigService.get('section.key')` using the shape defined below.
 *
 * MENTAL MODEL
 * ----------------------------------------------------------------------------
 *   .env file  --->  loaded by @nestjs/config  --->  configuration()  --->
 *   ConfigService  --->  injected into any service that needs settings
 *
 * WHY IT MATTERS
 * ----------------------------------------------------------------------------
 * Phase 11 (Security) requires secure configuration management: secrets
 * must never be hardcoded, and required settings should fail fast at
 * startup rather than causing confusing runtime bugs later.
 */

export interface AppConfig {
  env: string;
  port: number;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  argon2: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  lockout: {
    maxFailedAttempts: number;
    lockDurationMinutes: number;
  };
  tokens: {
    emailVerificationTtlHours: number;
    passwordResetTtlMinutes: number;
    invitationTtlDays: number;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  argon2: {
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST ?? '19456', 10),
    timeCost: parseInt(process.env.ARGON2_TIME_COST ?? '2', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM ?? '1', 10),
  },
  lockout: {
    maxFailedAttempts: parseInt(
      process.env.MAX_FAILED_LOGIN_ATTEMPTS ?? '5',
      10,
    ),
    lockDurationMinutes: parseInt(
      process.env.ACCOUNT_LOCK_DURATION_MINUTES ?? '15',
      10,
    ),
  },
  tokens: {
    emailVerificationTtlHours: parseInt(
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS ?? '24',
      10,
    ),
    passwordResetTtlMinutes: parseInt(
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? '30',
      10,
    ),
    invitationTtlDays: parseInt(
      process.env.INVITATION_TOKEN_TTL_DAYS ?? '7',
      10,
    ),
  },
  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
