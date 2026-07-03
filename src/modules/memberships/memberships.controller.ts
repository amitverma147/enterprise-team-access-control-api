import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * FILE PURPOSE
 * HTTP surface for Phase 3 (Memberships), nested under an organization.
 * Every route delegates ownership checks to `MembershipsService`, which in
 * turn reuses `OrganizationsService.assertOwner(...)`.
 */
@Controller('organizations/:organizationId/members')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  findAll(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.membershipsService.findAll(organizationId, userId);
  }

  @Post()
  addMember(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.membershipsService.addMember(organizationId, userId, dto);
  }

  @Patch(':membershipId')
  updateStatus(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.membershipsService.updateStatus(
      organizationId,
      userId,
      membershipId,
      dto,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':membershipId')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.membershipsService.remove(organizationId, userId, membershipId);
  }
}
