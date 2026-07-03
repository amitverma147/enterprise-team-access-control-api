import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Application composition root.
 *
 * PHASE 1 STATE: only Authentication is wired up. Global guards run, in
 * order, on every request:
 *   JwtAuthGuard    -> is there a valid access token? (unless @Public())
 *   ThrottlerGuard  -> has this client exceeded the rate limit?
 *
 * A basic global rate limit is included even at this early phase because an
 * auth endpoint without *any* throttling is an easy brute-force target —
 * Phase 11 (Security) will later add finer-grained, per-route limits.
 *
 * See /docs/ROADMAP.md for what gets added in each subsequent phase, and
 * /docs/SYSTEM_DESIGN.md for the full target architecture.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: 60_000,
            limit: 100,
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
