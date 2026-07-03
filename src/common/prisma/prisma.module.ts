import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Makes `PrismaService` available everywhere without importing this module
 * in every single feature module. Marked `@Global()` because nearly every
 * module in this project needs database access — it plays the same role a
 * "DatabaseModule" plays in most backend architectures.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
