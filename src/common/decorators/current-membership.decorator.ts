import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ResolvedMembership } from '../../modules/permissions/permissions.service';

/**
 * FILE PURPOSE
 * Reads `request.membership`, attached by `PermissionsGuard` once it has
 * resolved the caller's membership + permission set for the `:organizationId`
 * in the current route. Avoids a second database round-trip in controllers
 * that also need to know the membership id, status, or permission list.
 */
export const CurrentMembership = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ResolvedMembership | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.membership;
  },
);
