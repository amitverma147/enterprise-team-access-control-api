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
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';

/**
 * FILE PURPOSE
 * HTTP surface for Phase 3 (Memberships), nested under an organization.
 * `PermissionsGuard` (global) already guarantees the caller is an ACTIVE
 * member of `:organizationId` before any handler below runs; the
 * `@RequirePermissions(...)` decorators add the specific permission checks.
 */
@Controller('organizations/:organizationId/members')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @RequirePermissions('members:read')
  @Get()
  findAll(@Param('organizationId') organizationId: string) {
    return this.membershipsService.findAll(organizationId);
  }

  @RequirePermissions('members:invite')
  @Post()
  addMember(
    @Param('organizationId') organizationId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.membershipsService.addMember(organizationId, dto);
  }

  @RequirePermissions('members:suspend')
  @Patch(':membershipId')
  updateStatus(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.membershipsService.updateStatus(
      organizationId,
      membershipId,
      dto,
    );
  }

  @RequirePermissions('members:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':membershipId')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
  ) {
    await this.membershipsService.remove(organizationId, membershipId);
  }
}
