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
 * PHASE 2 STATE — INTENTIONALLY SIMPLE AUTHORIZATION
 * ----------------------------------------------------------------------------
 * There is no Membership or Role system yet (that's Phases 3–5), so
 * authorization here is the simplest thing that could possibly work: **only
 * the organization's `ownerId` may read, update, or delete it.** Every
 * mutating method takes the requesting user's id and checks it directly
 * against `organization.ownerId`.
 *
 * This is a real, working tenant boundary — it's just not yet
 * multi-person. Phase 3 introduces `Membership` so more than one user can
 * belong to an organization, and Phase 5 replaces these ownership checks
 * with a proper permission engine. Watch this file evolve across branches.
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

    return this.prisma.organization.create({
      data: { name: dto.name, slug, ownerId: userId },
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
    const organization = await this.getOwnedOrThrow(
      organizationId,
      requestingUserId,
    );
    return organization;
  }

  async update(
    organizationId: string,
    requestingUserId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.getOwnedOrThrow(organizationId, requestingUserId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name },
    });
  }

  /** Soft delete: keeps the row (and its future audit trail) but hides it from normal use. */
  async softDelete(organizationId: string, requestingUserId: string) {
    await this.getOwnedOrThrow(organizationId, requestingUserId);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { deletedAt: new Date() },
    });
  }

  private async getOwnedOrThrow(
    organizationId: string,
    requestingUserId: string,
  ) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.ownerId !== requestingUserId) {
      // Deliberately the same 404 a non-existent org would produce in a
      // richer system, but at this phase we're explicit for learning
      // purposes: a 403 makes the ownership rule visible while testing.
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
