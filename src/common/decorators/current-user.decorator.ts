import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Convenience decorator to pull the authenticated user off `request.user`,
 * which `JwtStrategy` (Phase 1) attaches after validating the access token.
 *
 * USAGE
 * ----------------------------------------------------------------------------
 *   @Get('me')
 *   getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 *   @Get('me')
 *   getUserId(@CurrentUser('sub') userId: string) { ... }
 */
export interface AuthenticatedUser {
  sub: string; // user id
  email: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
