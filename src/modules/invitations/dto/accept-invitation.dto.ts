import { IsString } from 'class-validator';

/** Validated request body for POST /invitations/accept. */
export class AcceptInvitationDto {
  @IsString()
  token!: string;
}
