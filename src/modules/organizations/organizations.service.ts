import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
 * PHASE 3 UPDATE
 * ----------------------------------------------------------------------------
 * `create()` now also creates an ACTIVE `Membership` row for the owner, in
 * the same database transaction as the `Organization` row itself (Phase 18
 * pattern: both writes succeed or neither does — you should never end up
 * with an organization that has no membership at all). See
 * `MembershipsService` for the rest of Phase 3, which reuses `assertOwner()`
 * below for its own ownership checks.
 *
 * AUTHORIZATION STILL OWNERSHIP-ONLY
 * ----------------------------------------------------------------------------
 * Even though a `Membership` now exists, read/update/delete authorization
 * here still checks `organization.ownerId` directly rather than membership
 * status/roles — there's no Role or Permission system yet (Phases 4–5).
 *
 * TENANT ISOLATION
 * ----------------------------------------------------------------------------
 * Every query filters `deletedAt: null` so soft-deleted organizations are
 * invisible to normal use, while still existing in the database for
 * historical/audit purposes.
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

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.name, slug, ownerId: userId },
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          status: 'ACTIVE',
        },
      });

      return organization;
    });
  }

  /** Lists all non-deleted organizations the given user owns. */
  async findAllForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(organizationId: string, requestingUserId: string) {
    return this.assertOwner(organizationId, requestingUserId);
  }

  async update(
    organizationId: string,
    requestingUserId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.assertOwner(organizationId, requestingUserId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name },
    });
  }

  /** Soft delete: keeps the row (and its future audit trail) but hides it from normal use. */
  async softDelete(organizationId: string, requestingUserId: string) {
    await this.assertOwner(organizationId, requestingUserId);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Fetches a non-deleted organization and throws unless `requestingUserId`
   * is its owner. Exposed (not private) so `MembershipsService` can reuse the
   * exact same rule instead of duplicating it.
   */
  async assertOwner(organizationId: string, requestingUserId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.ownerId !== requestingUserId) {
      throw new ForbiddenException('You do not own this organization');
    }
    return organization;
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
