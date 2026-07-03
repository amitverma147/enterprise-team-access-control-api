import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * FILE PURPOSE
 * Validated request body for POST /auth/register.
 * `class-validator` decorators enforce Phase 11 "input validation" at the
 * DTO boundary, before any business logic ever runs.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12, {
    message: 'Password must be at least 12 characters long',
  })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
