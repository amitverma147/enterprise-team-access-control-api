import { SetMetadata } from '@nestjs/common';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Marks a route as not requiring authentication.
 *
 * By default, `JwtAuthGuard` is applied globally (see `app.module.ts`), so
 * every route requires a valid access token unless explicitly opted out with
 * `@Public()`. This "secure by default" posture prevents someone from
 * forgetting to protect a new endpoint.
 *
 * USAGE
 * ----------------------------------------------------------------------------
 *   @Public()
 *   @Post('login')
 *   login(@Body() dto: LoginDto) { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
