import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { PERMISSIONS_KEY } from '../../modules/permissions/decorators/require-permissions.decorator';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Registered as a GLOBAL guard (see app.module.ts), running after
 * `JwtAuthGuard` on every request. Implements Phase 5 (Permission Engine)
 * and half of Phase 7 (tenant-aware authorization):
 *
 *   1. If the route has no `:organizationId` param, there's nothing to
 *      check here — let it through (e.g. POST /organizations, GET /auth/me).
 *   2. If it does, the caller MUST have an ACTIVE membership in that
 *      organization — this is the tenant-isolation check: even a valid,
 *      logged-in user cannot touch an organization they don't belong to.
 *   3. If the route is annotated with `@RequirePermissions(...)`, every
 *      listed permission must be present in the resolved permission set.
 *
 * The resolved membership is attached to `request.membership` so
 * controllers/services can avoid re-querying it (see `@CurrentMembership()`).
 */
@Injectable()
export class PermissionsGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawOrganizationId = request.params?.organizationId;

    if (!rawOrganizationId) {
      return true; // this route isn't organization-scoped
    }

    // Route params are always plain strings for our routes (Express types
    // them as `string | string[]` to account for repeated-param edge cases
    // that don't apply here).
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const membership = await this.permissionsService.resolveMembership(
      user.sub,
      organizationId,
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'You are not an active member of this organization',
      );
    }

    request.membership = membership;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const granted = new Set(membership.permissions);
    const missing = requiredPermissions.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required permission(s): ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
