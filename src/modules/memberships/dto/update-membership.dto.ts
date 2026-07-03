import { IsIn } from 'class-validator';

/**
 * Validated request body for PATCH /organizations/:organizationId/members/:membershipId.
 * Only ACTIVE <-> SUSPENDED transitions are allowed here; INVITED is set by
 * the invitation flow (Phase 8) and REMOVED is a DELETE, not a PATCH.
 */
export class UpdateMembershipDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}
