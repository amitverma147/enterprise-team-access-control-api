import { IsString } from 'class-validator';

/** Validated request body for POST /auth/refresh. */
export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
