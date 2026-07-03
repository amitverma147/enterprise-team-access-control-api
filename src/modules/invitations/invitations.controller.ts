import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';

/**
 * FILE PURPOSE
 * HTTP surface for Phase 8 (Invitations). The management routes are nested
 * under an organization and permission-guarded; `accept` is a top-level,
 * non-organization-scoped route (any authenticated user may attempt to
 * accept an invitation — `InvitationsService` verifies the token and email
 * match).
 */
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @RequirePermissions('members:invite')
  @Post('organizations/:organizationId/invitations')
  create(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(organizationId, userId, dto);
  }

  @RequirePermissions('invitations:read')
  @Get('organizations/:organizationId/invitations')
  findAll(@Param('organizationId') organizationId: string) {
    return this.invitationsService.findAll(organizationId);
  }

  @RequirePermissions('invitations:revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('organizations/:organizationId/invitations/:invitationId')
  async revoke(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
  ) {
    await this.invitationsService.revoke(organizationId, invitationId);
  }

  @Post('invitations/accept')
  accept(
    @CurrentUser('sub') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.invitationsService.accept(userId, userEmail, dto);
  }
}
