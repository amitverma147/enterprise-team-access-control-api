import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

export interface ResolvedMembership {
  membershipId: string;
  userId: string;
  organizationId: string;
  status: string;
  permissions: string[];
}

const CACHE_TTL_SECONDS = 300; // 5 minutes
const cacheKey = (userId: string, organizationId: string) =>
  `permissions:${userId}:${organizationId}`;

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * The heart of Phase 5 (Permission Engine) + Phase 6 (Permission Caching).
 *
 * Given a (userId, organizationId) pair, resolves:
 *   1. Whether the user has an ACTIVE membership in that organization.
 *   2. The union of every permission granted by every role attached to
 *      that membership.
 *
 * PHASE 6 UPDATE — REDIS CACHING
 * ----------------------------------------------------------------------------
 * Compare `resolveMembership` to the Phase 5 branch: its public signature
 * hasn't changed at all, but it now checks Redis first and only falls back
 * to Postgres on a cache miss. Permission checks happen on nearly every
 * request, but role/permission assignments change rarely — a classic
 * read-heavy, write-light cache.
 *
 * A 5-minute TTL bounds staleness even if an invalidation is ever missed,
 * but the real correctness guarantee is **explicit invalidation on every
 * write that could change the result**:
 *   - `invalidate(userId, organizationId)` — call after a membership's
 *     status changes (suspend/reactivate/remove), or after a role is
 *     assigned/unassigned on that membership.
 *   - `invalidateForRole(roleId)` — call after a role's own permission set
 *     changes; drops the cache for every membership holding that role.
 *
 * See `MembershipsService` and `RolesService` for where these are called.
 */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async resolveMembership(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedMembership | null> {
    const cached = await this.redis.getJson<ResolvedMembership>(
      cacheKey(userId, organizationId),
    );
    if (cached) {
      return cached;
    }

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

    const resolved: ResolvedMembership = {
      membershipId: membership.id,
      userId,
      organizationId,
      status: membership.status,
      permissions: [...permissionKeys],
    };

    await this.redis.setJson(
      cacheKey(userId, organizationId),
      resolved,
      CACHE_TTL_SECONDS,
    );

    return resolved;
  }

  /** Call after anything that changes a membership's effective permissions. */
  async invalidate(userId: string, organizationId: string): Promise<void> {
    await this.redis.del(cacheKey(userId, organizationId));
  }

  /** Call when a role's permissions change — invalidates everyone holding that role. */
  async invalidateForRole(roleId: string): Promise<void> {
    const memberships = await this.prisma.membershipRole.findMany({
      where: { roleId },
      include: { membership: true },
    });
    await Promise.all(
      memberships.map((mr) =>
        this.invalidate(mr.membership.userId, mr.membership.organizationId),
      ),
    );
  }
}
