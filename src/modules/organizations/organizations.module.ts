import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

/**
 * FILE PURPOSE
 * `@RequirePermissions(...)` on the controller is just metadata (no DI
 * needed) — actual permission resolution happens in the globally-registered
 * `PermissionsGuard`, wired up once in `app.module.ts`. This module doesn't
 * need to import `PermissionsModule` itself unless `OrganizationsService`
 * starts injecting `PermissionsService` directly (that happens in Phase 6,
 * for cache invalidation).
 */
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
