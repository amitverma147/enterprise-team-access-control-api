import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Augments Express's `Request` type with `request.user`, set by Passport's
 * JwtStrategy after validating the access token.
 *
 * We extend `Express.User` (an empty interface `passport`'s own types
 * declare for exactly this purpose) rather than redeclaring
 * `Request.user` directly — that avoids a conflicting duplicate property
 * declaration between our types and `@types/passport`.
 *
 * NOTE: From Phase 5 onward, this file also gains a `request.membership`
 * property once `PermissionsGuard` starts attaching resolved membership
 * data to the request.
 */
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
  }
}
