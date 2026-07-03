import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ResolvedMembership } from '../../modules/permissions/permissions.service';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Augments Express's `Request` type with:
 *   - `request.user`        set by Passport's JwtStrategy after validating
 *                            the access token (Phase 1).
 *   - `request.membership`  set by PermissionsGuard after resolving the
 *                            caller's membership + effective permissions for
 *                            the `:organizationId` in the current route
 *                            (Phase 5).
 *
 * We extend `Express.User` (an empty interface `passport`'s own types
 * declare for exactly this purpose) rather than redeclaring `Request.user`
 * directly — that avoids a conflicting duplicate property declaration
 * between our types and `@types/passport`.
 */
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}

    interface Request {
      membership?: ResolvedMembership;
    }
  }
}
