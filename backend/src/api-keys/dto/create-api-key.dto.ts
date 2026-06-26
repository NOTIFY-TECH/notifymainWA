import { IsString, IsOptional, Length, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Human-readable label for this key',
    example: 'Production integration',
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'ISO date string — key expires at this time',
    example: '2027-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
