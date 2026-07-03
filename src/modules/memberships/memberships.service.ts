import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 3 (Memberships): the lifecycle of a user's belonging to
 * an organization (ACTIVE, SUSPENDED, REMOVED) — independent from what
 * ROLES that membership holds (Roles don't exist until Phase 4).
 *
 * AUTHORIZATION: STILL OWNERSHIP-ONLY
 * ----------------------------------------------------------------------------
 * Every method here calls `organizationsService.assertOwner(...)` first —
 * only the organization's owner can view/add/change/remove members at this
 * phase. This is a real limitation (an ADMIN-type member couldn't manage
 * members yet even if that made sense) that Phase 4 (Roles) and Phase 5
 * (Permission Engine) exist specifically to remove.
 */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async findAll(organizationId: string, requestingUserId: string) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );

    return this.prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(
    organizationId: string,
    requestingUserId: string,
    dto: AddMemberDto,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );

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

    return this.prisma.membership.create({
      data: { userId: user.id, organizationId, status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async updateStatus(
    organizationId: string,
    requestingUserId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );
    await this.getWithinOrg(organizationId, membershipId);

    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: dto.status },
    });
  }

  async remove(
    organizationId: string,
    requestingUserId: string,
    membershipId: string,
  ) {
    const organization = await this.organizationsService.assertOwner(
      organizationId,
      requestingUserId,
    );
    const membership = await this.getWithinOrg(organizationId, membershipId);

    if (membership.userId === organization.ownerId) {
      throw new BadRequestException(
        'The organization owner cannot be removed from their own organization',
      );
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
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
