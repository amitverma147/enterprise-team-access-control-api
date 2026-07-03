import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 3 (Memberships): the lifecycle of a user's belonging to
 * an organization (ACTIVE, SUSPENDED, REMOVED) — independent from what
 * ROLES that membership holds (Phase 4/5, see RolesService).
 *
 * PHASE 6 UPDATE — CACHE INVALIDATION
 * ----------------------------------------------------------------------------
 * `PermissionsService` is injected again (it was removed in Phase 5's
 * version of this file). Every mutation that could change a membership's
 * effective permissions now calls `permissionsService.invalidate(...)`,
 * because a stale Redis entry would otherwise let a suspended/removed
 * member keep their old permissions until the 5-minute TTL expires.
 */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(organizationId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException(
        'No account exists with this email yet — Phase 8 will add invitations for people without an account.',
      );
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (existing) {
      throw new ConflictException(
        'This user is already a member of the organization',
      );
    }

    // New members get the baseline system MEMBER role by default -- without
    // this, an ACTIVE membership with zero roles would resolve to zero
    // permissions and be unable to do anything at all (see PermissionsGuard,
    // Phase 5). The org owner can grant additional roles afterward via
    // RolesService.assignToMembership.
    const memberRole = await this.prisma.role.findFirst({
      where: { organizationId: null, name: 'MEMBER' },
    });

    const membership = await this.prisma.$transaction(async (tx) => {
      const created = await tx.membership.create({
        data: { userId: user.id, organizationId, status: 'ACTIVE' },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      if (memberRole) {
        await tx.membershipRole.create({
          data: { membershipId: created.id, roleId: memberRole.id },
        });
      }

      return created;
    });

    // No cache entry could exist yet for a brand-new membership, but calling
    // invalidate() here keeps the pattern consistent and is a no-op cost.
    await this.permissionsService.invalidate(user.id, organizationId);
    return membership;
  }

  async updateStatus(
    organizationId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.getWithinOrg(organizationId, membershipId);

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { status: dto.status },
    });

    await this.permissionsService.invalidate(membership.userId, organizationId);
    return updated;
  }

  async remove(organizationId: string, membershipId: string) {
    const membership = await this.getWithinOrg(organizationId, membershipId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (organization?.ownerId === membership.userId) {
      throw new BadRequestException(
        'The organization owner cannot be removed from their own organization',
      );
    }

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' },
    });

    await this.permissionsService.invalidate(membership.userId, organizationId);
  }

  private async getWithinOrg(organizationId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found in this organization');
    }
    return membership;
  }
}
