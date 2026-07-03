import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Centralizes every cryptographic hashing decision in the app so the "how"
 * of hashing never leaks into business logic.
 *
 * WHY ARGON2ID FOR PASSWORDS (Phase 1)
 * ----------------------------------------------------------------------------
 * Passwords must be *hashed*, never encrypted — hashing is one-way, so even
 * if the database leaks, raw passwords cannot be recovered. Argon2id (winner
 * of the 2015 Password Hashing Competition) is deliberately slow and
 * memory-hard, which makes brute-forcing and GPU/ASIC cracking far more
 * expensive than older algorithms like bcrypt or plain SHA-256.
 *
 * WHY SHA-256 FOR OPAQUE TOKENS (refresh tokens, email verification,
 * password reset, invitations, API keys)
 * ----------------------------------------------------------------------------
 * These tokens are already high-entropy random strings (not user-chosen
 * secrets), so we don't need Argon2's slowness — we only need to avoid
 * storing the raw secret in the database (in case of a DB leak, an attacker
 * shouldn't be able to use the row directly as a valid token). A fast
 * cryptographic hash (SHA-256) is the right, standard tool here.
 */
@Injectable()
export class HashingService {
  constructor(private readonly config: ConfigService) {}

  /** Hash a plaintext password for storage. Uses Argon2id. */
  async hashPassword(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: this.config.get<number>('argon2.memoryCost'),
      timeCost: this.config.get<number>('argon2.timeCost'),
      parallelism: this.config.get<number>('argon2.parallelism'),
    });
  }

  /** Compare a plaintext password against a stored Argon2id hash. */
  async verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
    return argon2.verify(hash, plainPassword);
  }

  /**
   * Generate a high-entropy opaque token (used for refresh tokens, email
   * verification links, password reset links, invitations, API keys).
   * Returns the raw token (sent to the user) — callers must hash it with
   * `hashOpaqueToken` before persisting.
   */
  generateOpaqueToken(byteLength = 32): string {
    return randomBytes(byteLength).toString('base64url');
  }

  /** Deterministically hash an opaque token for safe storage/lookup. */
  hashOpaqueToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
