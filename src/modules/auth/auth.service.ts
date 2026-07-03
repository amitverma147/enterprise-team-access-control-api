import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HashingService } from './hashing.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Metadata captured about the client making the auth request. */
export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 1 (Authentication) end to end:
 *   - register()       -> create account + send email verification token
 *   - login()          -> verify credentials, enforce account lockout
 *   - refresh()        -> rotate refresh tokens, detect theft/reuse
 *   - logout()         -> revoke a single refresh token/session
 *   - verifyEmail()    -> consume an email verification token
 *
 * SECURITY DESIGN NOTES
 * ----------------------------------------------------------------------------
 * 1. Access tokens are short-lived signed JWTs (stateless, not stored in DB).
 * 2. Refresh tokens are long-lived, opaque, random strings. Only their SHA-256
 *    hash is stored — a stolen database dump doesn't hand out usable tokens.
 * 3. Refresh tokens ROTATE on every use: using one invalidates it and issues
 *    a new one in the same "family". If a REVOKED token is ever presented
 *    again, that's a strong signal of theft (someone replayed an old token),
 *    so we revoke the *entire family* and force the user to log in again.
 * 4. Account lockout: after N consecutive failed login attempts, the account
 *    is temporarily locked, slowing down credential-stuffing/brute-force
 *    attacks without permanently locking out legitimate users.
 * 5. Generic error messages ("invalid credentials") are used for both
 *    "user not found" and "wrong password" so attackers can't enumerate
 *    which emails are registered.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hashing.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
      },
    });

    await this.prisma.passwordHistoryEntry.create({
      data: { userId: user.id, passwordHash },
    });

    await this.issueEmailVerificationToken(user.id, user.email);

    const tokens = await this.issueTokenPair(user.id, user.email, meta);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Same generic error whether the user doesn't exist or the password is
    // wrong — prevents account enumeration via error messages.
    const genericError = () =>
      new UnauthorizedException('Invalid email or password');

    if (!user) {
      throw genericError();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account temporarily locked due to repeated failed login attempts. Try again after ${user.lockedUntil.toISOString()}.`,
      );
    }

    const passwordValid = await this.hashing.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!passwordValid) {
      await this.registerFailedLoginAttempt(user.id, user.failedLoginAttempts);
      throw genericError();
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.issueTokenPair(user.id, user.email, meta);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async refresh(
    rawRefreshToken: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const tokenHash = this.hashing.hashOpaqueToken(rawRefreshToken);

    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existingToken.revokedAt) {
      // Reuse of an already-rotated-away token: possible theft. Nuke the
      // whole family so the attacker (and the legitimate user) are both
      // forced to re-authenticate.
      this.logger.warn(
        `Refresh token reuse detected for user ${existingToken.userId} (family ${existingToken.family}). Revoking family.`,
      );
      await this.revokeTokenFamily(existingToken.family);
      throw new UnauthorizedException(
        'Refresh token has already been used. All sessions in this chain have been revoked.',
      );
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Rotate: revoke the old token and issue a new one in the same family.
    const newRawToken = this.hashing.generateOpaqueToken();
    const newTokenHash = this.hashing.hashOpaqueToken(newRawToken);
    const expiresAt = this.computeRefreshExpiry();

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: newTokenHash,
          family: existingToken.family,
          expiresAt,
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
        },
      });

      await tx.refreshToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date(), replacedByTokenId: created.id },
      });

      // Keep the user-visible Session row pointed at the current token.
      await tx.session.updateMany({
        where: { refreshTokenId: existingToken.id },
        data: { refreshTokenId: created.id, lastActiveAt: new Date() },
      });

      return created;
    });

    const accessToken = await this.signAccessToken(
      existingToken.userId,
      existingToken.user.email,
    );

    return { accessToken, refreshToken: newRawToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashing.hashOpaqueToken(rawRefreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!token || token.revokedAt) {
      return; // idempotent: already logged out
    }
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { refreshTokenId: token.id },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = this.hashing.hashOpaqueToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Verification link is invalid or has expired',
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);
  }

  // --------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------

  private async issueTokenPair(
    userId: string,
    email: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(userId, email);

    const rawRefreshToken = this.hashing.generateOpaqueToken();
    const tokenHash = this.hashing.hashOpaqueToken(rawRefreshToken);
    const expiresAt = this.computeRefreshExpiry();
    const family = randomUUID();

    const refreshToken = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        family,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    // Phase 9: every fresh login/register creates a visible "session" the
    // user can later review/revoke from a "manage devices" screen.
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenId: refreshToken.id,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async signAccessToken(
    userId: string,
    email: string,
  ): Promise<string> {
    return this.jwt.signAsync({ sub: userId, email }, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl') as string,
    } as JwtSignOptions);
  }

  private computeRefreshExpiry(): Date {
    const ttl = this.config.get<string>('jwt.refreshTtl') ?? '30d';
    return new Date(Date.now() + parseDurationMs(ttl));
  }

  private async registerFailedLoginAttempt(
    userId: string,
    currentAttempts: number,
  ): Promise<void> {
    const maxAttempts = this.config.get<number>('lockout.maxFailedAttempts')!;
    const lockMinutes = this.config.get<number>('lockout.lockDurationMinutes')!;

    const nextAttempts = currentAttempts + 1;
    const shouldLock = nextAttempts >= maxAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: shouldLock ? 0 : nextAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + lockMinutes * 60_000)
          : undefined,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `User ${userId} locked out after ${nextAttempts} failed attempts`,
      );
    }
  }

  private async revokeTokenFamily(family: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { family, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { refreshToken: { family } },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
  ): Promise<void> {
    const rawToken = this.hashing.generateOpaqueToken();
    const tokenHash = this.hashing.hashOpaqueToken(rawToken);
    const ttlHours = this.config.get<number>(
      'tokens.emailVerificationTtlHours',
    )!;

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60_000),
      },
    });

    // NOTE: This project stubs email delivery with a log line. Swap this for
    // a real email provider (SES, Postmark, Resend, etc.) in production —
    // the rest of the verification flow (token generation, hashing,
    // expiry, single-use consumption) is already production-shaped.
    this.logger.log(
      `[stub email] Verification link for ${email}: /auth/verify-email?token=${rawToken}`,
    );
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    fullName: string | null;
    emailVerified: boolean;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}

/** Parses simple durations like "15m", "30d", "12h" into milliseconds. */
function parseDurationMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * unitMs[unit];
}
