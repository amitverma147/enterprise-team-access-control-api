import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 2 (Organizations): multi-tenant creation, ownership, and
 * soft-delete.
 *
 * PHASE 5 UPDATE — OWNERSHIP CHECKS REMOVED FROM HERE
 * ----------------------------------------------------------------------------
 * Compare this file to the Phase 2–4 branches: `findOne`, `update`, and
 * `softDelete` no longer take a `requestingUserId` or call
 * `assertOwner(...)`. That job now belongs entirely to the global
 * `PermissionsGuard` + `@RequirePermissions(...)` on the controller — by the
 * time a service method runs, the guard has already confirmed the caller is
 * an ACTIVE member with the right permission. This is a meaningful
 * simplification: the service only needs to worry about *business* rules
 * (does the org exist? is the slug taken?), not *authorization* rules.
 *
 * `create()` now also assigns the system OWNER role to the creator's
 * membership — see the Phase 18 note below.
 *
 * WHY A TRANSACTION IN create() (Phase 18)
 * ----------------------------------------------------------------------------
 * Creating an organization requires THREE writes to stay consistent: the
 * `Organization` row, the creator's `Membership` row, and a
 * `MembershipRole` row granting them the system OWNER role. If any one of
 * these failed after another succeeded, we'd end up with an org that has no
 * owner, or a membership with no role — a broken tenant. Wrapping all three
 * in `$transaction` guarantees all-or-nothing.
 *
 * TENANT ISOLATION (Phase 7)
 * ----------------------------------------------------------------------------
 * Every query here still filters `deletedAt: null` / scopes by
 * `organizationId` — even though `PermissionsGuard` already checked
 * membership, this service filtering is the second line of defense
 * (defense-in-depth).
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug ?? slugify(dto.name);

    const slugTaken = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (slugTaken) {
      throw new ConflictException(
        'An organization with this slug already exists',
      );
    }

    const ownerRole = await this.prisma.role.findFirst({
      where: { organizationId: null, name: 'OWNER' },
    });
    if (!ownerRole) {
      throw new NotFoundException(
        'System OWNER role not found — did you run `npm run prisma:seed`?',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.name, slug, ownerId: userId },
      });

      const membership = await tx.membership.create({
        data: { userId, organizationId: organization.id, status: 'ACTIVE' },
      });

      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: ownerRole.id },
      });

      return organization;
    });
  }

  /** Lists all non-deleted organizations the given user is an active member of. */
  async findAllForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE', organization: { deletedAt: null } },
      include: { organization: true },
    });
    return memberships.map((m) => m.organization);
  }

  async findOne(organizationId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto) {
    await this.findOne(organizationId); // 404 if missing/deleted
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name },
    });
  }

  /** Soft delete: keeps the row (and its future audit trail) but hides it from normal use. */
  async softDelete(organizationId: string) {
    await this.findOne(organizationId); // 404 if missing/deleted
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { deletedAt: new Date() },
    });
  }
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}
