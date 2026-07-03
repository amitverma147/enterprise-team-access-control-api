import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 3 (Memberships): the lifecycle of a user's belonging to
 * an organization (ACTIVE, SUSPENDED, REMOVED) — independent from what
 * ROLES that membership holds (Phase 4/5, see RolesService).
 *
 * PHASE 5 UPDATE — OWNERSHIP CHECKS REMOVED FROM HERE
 * ----------------------------------------------------------------------------
 * Compare to Phase 3/4: every method dropped its `requestingUserId` param
 * and the `organizationsService.assertOwner(...)` call. Authorization is now
 * `@RequirePermissions(...)` on the controller (`members:read`,
 * `members:invite`, `members:suspend`, `members:remove`), enforced by the
 * global `PermissionsGuard` before these methods ever run. This is the
 * concrete payoff of Phase 4/5: an ADMIN — not just the literal owner — can
 * now manage members, because ADMIN's seeded permission set includes these
 * `members:*` keys.
 */
@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: { userId: user.id, organizationId, status: 'ACTIVE' },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      if (memberRole) {
        await tx.membershipRole.create({
          data: { membershipId: membership.id, roleId: memberRole.id },
        });
      }

      return membership;
    });
  }

  async updateStatus(
    organizationId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.getWithinOrg(organizationId, membershipId);
    return this.prisma.membership.update({
      where: { id: membership.id },
      data: { status: dto.status },
    });
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
