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

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * HTTP surface for Phase 2 (Organizations). Every route is protected by the
 * global `JwtAuthGuard` (you must be logged in); ownership checks happen
 * inside `OrganizationsService` for now (see that file's header comment for
 * why — this gets replaced by a real permission engine in Phase 5).
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

  @Get(':organizationId')
  findOne(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.organizationsService.findOne(organizationId, userId);
  }

  @Patch(':organizationId')
  update(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(organizationId, userId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':organizationId')
  async remove(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.organizationsService.softDelete(organizationId, userId);
  }
}
