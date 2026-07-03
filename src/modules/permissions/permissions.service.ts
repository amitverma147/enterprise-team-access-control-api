import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ResolvedMembership {
  membershipId: string;
  userId: string;
  organizationId: string;
  status: string;
  permissions: string[];
}

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * The heart of Phase 5 (Permission Engine).
 *
 * Given a (userId, organizationId) pair, resolves:
 *   1. Whether the user has a membership in that organization, and its status.
 *   2. The union of every permission granted by every role attached to
 *      that membership.
 *
 * WHY THIS BEATS `user.role === 'admin'` CHECKS
 * ----------------------------------------------------------------------------
 * A membership can hold multiple roles, each contributing different
 * permissions. Adding a new permission or role never requires touching
 * guard/controller code — it's entirely data-driven (Role -> RolePermission
 * -> Permission rows, built up in Phase 4).
 *
 * PHASE 5 STATE: every call hits the database directly. This is correct but
 * not free — permission checks now happen on nearly every request. Phase 6
 * (Permission Caching) adds a Redis layer in front of exactly this method,
 * with explicit invalidation on writes that could change the result. Watch
 * this file gain a cache in the next branch without changing its public
 * shape (`resolveMembership` keeps the same signature).
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMembership(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedMembership | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    const permissionKeys = new Set<string>();
    for (const membershipRole of membership.roles) {
      for (const rolePermission of membershipRole.role.permissions) {
        permissionKeys.add(rolePermission.permission.key);
      }
    }

    return {
      membershipId: membership.id,
      userId,
      organizationId,
      status: membership.status,
      permissions: [...permissionKeys],
    };
  }
}
