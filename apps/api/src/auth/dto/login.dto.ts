import { IsEmail, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
