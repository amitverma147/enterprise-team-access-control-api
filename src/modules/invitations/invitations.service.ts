import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HashingService } from '../auth/hashing.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Implements Phase 8 (Invitations): a secure, one-time-token workflow for
 * bringing new people into an organization, including people who don't have
 * an account yet — unlike Phase 3's `MembershipsService.addMember`, which
 * only works for existing users.
 *
 * SECURITY DESIGN (reuses Phase 1 patterns)
 * ----------------------------------------------------------------------------
 * The invitation token is generated and hashed exactly like refresh tokens
 * and email verification tokens (`HashingService.generateOpaqueToken()` /
 * `hashOpaqueToken()`): the raw token is only ever shown once (in the
 * "email"), and only its SHA-256 hash is stored, so a database leak can't be
 * used to accept invitations directly.
 *
 * `accept()` requires the caller to already be authenticated AND have an
 * email matching the invitation — this prevents someone from intercepting a
 * token meant for a different email address and using it to join under
 * their own account.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly config: ConfigService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(
    organizationId: string,
    invitedByUserId: string,
    dto: CreateInvitationDto,
  ) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: dto.roleId,
        OR: [{ organizationId: null }, { organizationId }],
      },
    });
    if (!role) {
      throw new NotFoundException(
        'Role not found or not available to this organization',
      );
    }

    const existingMember = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingMember) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId: existingMember.id, organizationId },
        },
      });
      if (membership && membership.status !== 'REMOVED') {
        throw new ConflictException(
          'This user is already a member of the organization',
        );
      }
    }

    const pending = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: dto.email.toLowerCase(),
        status: 'PENDING',
      },
    });
    if (pending) {
      throw new ConflictException(
        'An invitation is already pending for this email',
      );
    }

    const rawToken = this.hashing.generateOpaqueToken();
    const tokenHash = this.hashing.hashOpaqueToken(rawToken);
    const ttlDays = this.config.get<number>('tokens.invitationTtlDays')!;

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: dto.email.toLowerCase(),
        roleId: dto.roleId,
        invitedByUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60_000),
      },
    });

    // NOTE: email delivery is stubbed, same as Phase 1's verification email.
    this.logger.log(
      `[stub email] Invitation link for ${dto.email}: /invitations/accept?token=${rawToken}`,
    );

    return invitation;
  }

  async findAll(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(organizationId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found in this organization');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be revoked');
    }
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }

  async accept(userId: string, userEmail: string, dto: AcceptInvitationDto) {
    const tokenHash = this.hashing.hashOpaqueToken(dto.token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new BadRequestException(
        'Invitation is invalid or has already been used',
      );
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }
    if (invitation.email !== userEmail.toLowerCase()) {
      throw new BadRequestException(
        'This invitation was sent to a different email address',
      );
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      const created = await tx.membership.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invitation.organizationId,
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          userId,
          organizationId: invitation.organizationId,
          status: 'ACTIVE',
        },
      });

      await tx.membershipRole.upsert({
        where: {
          membershipId_roleId: {
            membershipId: created.id,
            roleId: invitation.roleId,
          },
        },
        update: {},
        create: { membershipId: created.id, roleId: invitation.roleId },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return created;
    });

    await this.permissionsService.invalidate(userId, invitation.organizationId);
    return membership;
  }
}
