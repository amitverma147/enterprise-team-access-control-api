import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Validated request body for PATCH /organizations/:organizationId. */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}
