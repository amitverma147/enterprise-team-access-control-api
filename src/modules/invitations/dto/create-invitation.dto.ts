import { IsEmail, IsString } from 'class-validator';

/** Validated request body for POST /organizations/:organizationId/invitations. */
export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsString()
  roleId!: string;
}
