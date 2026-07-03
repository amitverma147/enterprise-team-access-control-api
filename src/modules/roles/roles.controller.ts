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
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';

/**
 * FILE PURPOSE
 * HTTP surface for Phase 4 (Roles): CRUD on custom roles, plus assigning/
 * removing roles on a membership (the bridge to Phase 5's permission
 * resolution).
 */
@Controller('organizations/:organizationId')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequirePermissions('roles:read')
  @Get('roles')
  findAll(@Param('organizationId') organizationId: string) {
    return this.rolesService.findAll(organizationId);
  }

  @RequirePermissions('roles:manage')
  @Post('roles')
  create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(organizationId, dto);
  }

  @RequirePermissions('roles:manage')
  @Patch('roles/:roleId')
  update(
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(organizationId, roleId, dto);
  }

  @RequirePermissions('roles:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('roles/:roleId')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.rolesService.remove(organizationId, roleId);
  }

  @RequirePermissions('roles:assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('members/:membershipId/roles/:roleId')
  async assign(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.rolesService.assignToMembership(
      organizationId,
      membershipId,
      roleId,
    );
  }

  @RequirePermissions('roles:assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('members/:membershipId/roles/:roleId')
  async unassign(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.rolesService.removeFromMembership(
      organizationId,
      membershipId,
      roleId,
    );
  }
}
