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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../permissions/decorators/require-permissions.decorator';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * HTTP surface for Phase 2 (Organizations).
 *
 * PHASE 5 UPDATE: compare this file to the Phase 2–4 branches. Ownership
 * checks are gone from here entirely, replaced by `@RequirePermissions(...)`.
 * `POST /organizations` and `GET /organizations` have no `:organizationId`
 * route param, so the global `PermissionsGuard` lets them through untouched
 * — any authenticated user may create an organization (becoming its OWNER)
 * or list the ones they belong to. Every other route has `:organizationId`,
 * so the guard enforces active membership + the listed permission
 * automatically, before the handler ever runs.
 */
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string) {
    return this.organizationsService.findAllForUser(userId);
  }

  @RequirePermissions('org:read')
  @Get(':organizationId')
  findOne(@Param('organizationId') organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  @RequirePermissions('org:update')
  @Patch(':organizationId')
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(organizationId, dto);
  }

  @RequirePermissions('org:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':organizationId')
  async remove(@Param('organizationId') organizationId: string) {
    await this.organizationsService.softDelete(organizationId);
  }
}
