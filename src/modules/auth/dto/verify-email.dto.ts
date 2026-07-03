import { IsString } from 'class-validator';

/** Validated request body for POST /auth/verify-email. */
export class VerifyEmailDto {
  @IsString()
  token!: string;
}
