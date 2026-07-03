import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 4 (Roles): built-in system roles (OWNER/ADMIN/MEMBER,
 * seeded in prisma/seed.ts, `organizationId = null`) plus organization-
 * specific custom roles, and assigning/removing roles on a Membership.
 *
 * PHASE 4 STATE — ROLES EXIST, BUT DON'T DO ANYTHING YET
 * ----------------------------------------------------------------------------
 * This is an important, deliberate milestone: after this phase, you can
 * create custom roles and assign them to members, and the data model fully
 * supports many-to-many Membership <-> Role <-> Permission relationships —
 * but nothing in the API actually *checks* those permissions yet.
 * Authorization for managing roles is still ownership-only, same as
 * Phases 2–3. Phase 5 (Permission Engine) is what makes roles/permissions
 * actually affect what a request is allowed to do — read that phase's
 * `PermissionsService` to see the payoff of the data model built here.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /** System roles (available to every org) + this org's custom roles. */
  async findAll(organizationId: string, requestingUserId: string) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );

    return this.prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    organizationId: string,
    requestingUserId: string,
    dto: CreateRoleDto,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );

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

  async update(
    organizationId: string,
    requestingUserId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );
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

    return this.prisma.role.update({
      where: { id: role.id },
      data: { name: dto.name },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async remove(
    organizationId: string,
    requestingUserId: string,
    roleId: string,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );
    await this.getCustomRoleOrThrow(organizationId, roleId);
    await this.prisma.role.delete({ where: { id: roleId } });
  }

  async assignToMembership(
    organizationId: string,
    requestingUserId: string,
    membershipId: string,
    roleId: string,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );
    await this.getMembershipOrThrow(organizationId, membershipId);
    await this.getAssignableRoleOrThrow(organizationId, roleId);

    await this.prisma.membershipRole.upsert({
      where: { membershipId_roleId: { membershipId, roleId } },
      update: {},
      create: { membershipId, roleId },
    });
  }

  async removeFromMembership(
    organizationId: string,
    requestingUserId: string,
    membershipId: string,
    roleId: string,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );
    await this.getMembershipOrThrow(organizationId, membershipId);

    await this.prisma.membershipRole.deleteMany({
      where: { membershipId, roleId },
    });
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
