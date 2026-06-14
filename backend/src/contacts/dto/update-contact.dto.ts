import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsBoolean()
  isOptedOut?: boolean;
}
