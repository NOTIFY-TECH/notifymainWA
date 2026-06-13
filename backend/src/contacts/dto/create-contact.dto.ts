import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsArray,
} from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MaxLength(20)
  phoneNumber: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
