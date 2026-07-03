import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * FILE PURPOSE
 * Global module so any feature module can inject `RedisService` without
 * re-importing it everywhere — same rationale as `PrismaModule`.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
