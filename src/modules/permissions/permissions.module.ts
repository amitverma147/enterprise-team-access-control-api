import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * FILE PURPOSE
 * Exposes `PermissionsService` (Phase 5) for injection into the global
 * `PermissionsGuard` and into other feature modules.
 */
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
