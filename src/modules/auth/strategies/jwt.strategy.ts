import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Validates the short-lived JWT **access token** sent as
 * `Authorization: Bearer <token>` on every protected request.
 *
 * This strategy does NOT hit the database — access tokens are stateless by
 * design (that's why they're short-lived, see JWT_ACCESS_TTL). Anything that
 * needs to be fresh (permissions, membership status) is re-checked further
 * down the pipeline by `PermissionsGuard` (Phase 5), which *does* query the
 * database/cache.
 *
 * The payload returned here becomes `request.user`, retrievable via the
 * `@CurrentUser()` decorator.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return { sub: payload.sub, email: payload.email };
  }
}
