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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * FILE PURPOSE
 * HTTP surface for Phase 4 (Roles): CRUD on custom roles, plus assigning/
 * removing roles on a membership. Authorization is ownership-only for now
 * (see `RolesService`'s header comment).
 */
@Controller('organizations/:organizationId')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  findAll(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.rolesService.findAll(organizationId, userId);
  }

  @Post('roles')
  create(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(organizationId, userId, dto);
  }

  @Patch('roles/:roleId')
  update(
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(organizationId, userId, roleId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('roles/:roleId')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.rolesService.remove(organizationId, userId, roleId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('members/:membershipId/roles/:roleId')
  async assign(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.rolesService.assignToMembership(
      organizationId,
      userId,
      membershipId,
      roleId,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('members/:membershipId/roles/:roleId')
  async unassign(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.rolesService.removeFromMembership(
      organizationId,
      userId,
      membershipId,
      roleId,
    );
  }
}
