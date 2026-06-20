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

  // Validated and normalised in ContactsService.updateContact via the same
  // normalisePhone() util used by importContacts — not via @Transform here,
  // because an invalid number needs a proper 400 with a reason, not a
  // silently-mangled value passed through.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @IsOptional()
  @IsBoolean()
  isOptedOut?: boolean;
}
