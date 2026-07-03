import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Applied globally (see `app.module.ts` -> APP_GUARD) so every route is
 * protected by default. Routes explicitly marked `@Public()` skip the JWT
 * check entirely (e.g. /auth/login, /auth/register, /health).
 *
 * "Secure by default" is a Phase 11 principle: it's much safer to have to
 * opt OUT of auth than to remember to opt IN on every new controller.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
