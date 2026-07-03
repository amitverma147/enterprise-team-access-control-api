import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Wraps Prisma's generated `PrismaClient` as an injectable Nest provider.
 *
 * Every module that needs the database injects `PrismaService` instead of
 * instantiating `new PrismaClient()` itself. This gives us:
 *   1. A single shared connection pool for the whole app.
 *   2. Lifecycle hooks so we connect/disconnect cleanly with Nest's
 *      bootstrap/shutdown process.
 *   3. One place to enable query logging or add Prisma middleware later
 *      (e.g. soft-delete filtering, automatic audit metadata).
 *
 * WHY IT MATTERS (Phase 18 — Database Transactions)
 * ----------------------------------------------------------------------------
 * `PrismaService` also exposes `$transaction` (inherited from PrismaClient),
 * which services use to wrap multi-step writes (e.g. "create organization +
 * create owner membership + assign OWNER role") so they either fully commit
 * or fully roll back.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
