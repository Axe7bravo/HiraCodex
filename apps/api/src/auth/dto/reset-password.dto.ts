import { IsString, Length, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(256)
  token!: string;

  @IsString()
  @Length(8, 128)
  newPassword!: string;
}
