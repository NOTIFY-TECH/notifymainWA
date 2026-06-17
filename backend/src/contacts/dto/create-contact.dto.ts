import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalisePhone } from '../../common/utils/phone.util';

export class CreateContactDto {
  // @Transform runs before @Matches because class-transformer runs before
  // class-validator when transform: true is set on the global ValidationPipe.
  // So we normalise first, then validate the normalised result.
  @ApiProperty({
    example: '919876543210',
    description:
      'Phone number in bare E.164 format (no +). ' +
      'Also accepts +91..., bare 10-digit Indian numbers, and international ' +
      'numbers with common formatting (spaces, dashes) — these are normalised automatically.',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const result = normalisePhone(value);
    // Return the normalised value if valid; return original if invalid so
    // @Matches can surface a clean validation error rather than storing garbage.
    return result.valid ? result.normalised : value.trim();
  })
  @IsString()
  @MaxLength(20)
  @Matches(/^\d{10,15}$/, {
    message:
      'phoneNumber must be a valid phone number (10–15 digits, no + or spaces). ' +
      'Accepted formats: 919876543210, +919876543210, 9876543210, +1 650 555 0123.',
  })
  phoneNumber: string;

  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'rahul@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String], example: ['vip', 'lead'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
