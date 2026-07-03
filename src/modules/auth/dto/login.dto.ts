import { IsEmail, IsString } from 'class-validator';

/** Validated request body for POST /auth/login. */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
