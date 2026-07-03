import { IsEmail } from 'class-validator';

/**
 * Validated request body for POST /organizations/:organizationId/members.
 *
 * PHASE 3 NOTE: this is a deliberately simple "add an existing user to my
 * organization by email" endpoint — the target user must already have an
 * account. Phase 8 (Invitations) replaces/supplements this with a proper
 * invite-by-email-token flow that works even for people who haven't signed
 * up yet.
 */
export class AddMemberDto {
  @IsEmail()
  email!: string;
}
