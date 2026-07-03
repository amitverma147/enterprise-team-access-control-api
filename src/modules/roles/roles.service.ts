import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 4 (Roles): built-in system roles (OWNER/ADMIN/MEMBER,
 * seeded in prisma/seed.ts, `organizationId = null`) plus organization-
 * specific custom roles, and assigning/removing roles on a Membership.
 *
 * PHASE 6 UPDATE — CACHE INVALIDATION
 * ----------------------------------------------------------------------------
 * `PermissionsService` is injected again (removed in Phase 5's version).
 * Changing a role's permission set, assigning a role, or unassigning a role
 * all change what a membership is allowed to do — each now calls
 * `invalidateForRole(...)` or `invalidate(...)` so `PermissionsGuard` never
 * serves a stale, cached permission set after one of these writes.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /** System roles (available to every org) + this org's custom roles. */
  async findAll(organizationId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(organizationId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'A role with this name already exists in this organization',
      );
    }

    const permissions = await this.resolvePermissions(dto.permissionKeys);

    return this.prisma.role.create({
      data: {
        name: dto.name,
        organizationId,
        isSystem: false,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async update(organizationId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.getCustomRoleOrThrow(organizationId, roleId);

    if (dto.permissionKeys) {
      const permissions = await this.resolvePermissions(dto.permissionKeys);
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId } }),
        this.prisma.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId, permissionId: p.id })),
        }),
      ]);
    }

    const updated = await this.prisma.role.update({
      where: { id: role.id },
      data: { name: dto.name },
      include: { permissions: { include: { permission: true } } },
    });

    await this.permissionsService.invalidateForRole(roleId);
    return updated;
  }

  async remove(organizationId: string, roleId: string) {
    await this.getCustomRoleOrThrow(organizationId, roleId);
    await this.permissionsService.invalidateForRole(roleId);
    await this.prisma.role.delete({ where: { id: roleId } });
  }

  async assignToMembership(
    organizationId: string,
    membershipId: string,
    roleId: string,
  ) {
    const membership = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );
    await this.getAssignableRoleOrThrow(organizationId, roleId);

    await this.prisma.membershipRole.upsert({
      where: { membershipId_roleId: { membershipId, roleId } },
      update: {},
      create: { membershipId, roleId },
    });

    await this.permissionsService.invalidate(membership.userId, organizationId);
  }

  async removeFromMembership(
    organizationId: string,
    membershipId: string,
    roleId: string,
  ) {
    const membership = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );
    await this.prisma.membershipRole.deleteMany({
      where: { membershipId, roleId },
    });
    await this.permissionsService.invalidate(membership.userId, organizationId);
  }

  // --------------------------------------------------------------------

  private async resolvePermissions(keys: string[]) {
    if (keys.length === 0) {
      throw new BadRequestException('A role must have at least one permission');
    }
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
    });
    if (permissions.length !== new Set(keys).size) {
      const found = new Set(permissions.map((p) => p.key));
      const unknown = keys.filter((k) => !found.has(k));
      throw new BadRequestException(
        `Unknown permission key(s): ${unknown.join(', ')}`,
      );
    }
    return permissions;
  }

  private async getCustomRoleOrThrow(organizationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId },
    });
    if (!role) {
      throw new NotFoundException('Custom role not found in this organization');
    }
    if (role.isSystem) {
      throw new BadRequestException(
        'System roles cannot be modified or deleted',
      );
    }
    return role;
  }

  /** A role assignable to a membership: either a system role or this org's own custom role. */
  private async getAssignableRoleOrThrow(
    organizationId: string,
    roleId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, OR: [{ organizationId: null }, { organizationId }] },
    });
    if (!role) {
      throw new NotFoundException(
        'Role not found or not available to this organization',
      );
    }
    return role;
  }

  private async getMembershipOrThrow(
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found in this organization');
    }
    return membership;
  }
}
