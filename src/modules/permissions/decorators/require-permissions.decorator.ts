import { SetMetadata } from '@nestjs/common';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Declarative permission requirements on a route, read by `PermissionsGuard`.
 *
 * USAGE
 * ----------------------------------------------------------------------------
 *   @RequirePermissions('members:invite')
 *   @Post(':organizationId/members/invite')
 *   invite(...) { ... }
 *
 * The route MUST have an `:organizationId` route param — that's how the
 * guard knows which tenant to check membership/permissions against.
 *
 * If a route only needs "any active member of this org" with no specific
 * permission, simply omit this decorator: `PermissionsGuard` still enforces
 * active membership whenever an `:organizationId` param is present.
 */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
