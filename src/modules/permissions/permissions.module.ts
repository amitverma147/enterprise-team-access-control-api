import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * FILE PURPOSE
 * Exposes `PermissionsService` (Phase 5 & 6) for injection into the global
 * `PermissionsGuard` and into other feature modules (Memberships, Roles)
 * that need to invalidate cached permissions after a mutation.
 */
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
