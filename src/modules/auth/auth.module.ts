import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashingService } from './hashing.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Wires together everything needed for Phase 1 (Authentication):
 *   - PassportModule + JwtStrategy: validates incoming access tokens.
 *   - JwtModule: signs new access tokens (refresh tokens are hand-rolled
 *     opaque tokens, not JWTs — see HashingService for why).
 *   - AuthService/AuthController: register, login, refresh, logout, verify.
 *
 * `HashingService` and `JwtStrategy` are exported so other modules (e.g. a
 * future "users" module needing password verification) can reuse them
 * without duplicating logic.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, HashingService, JwtStrategy],
  exports: [HashingService],
})
export class AuthModule {}
