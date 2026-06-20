import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  messageTemplate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({
    description:
      'MIME type of the media file, e.g. image/jpeg, video/mp4, application/pdf',
  })
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Send to all contacts having any of these tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ default: 30, minimum: 10, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(60)
  rateLimitPerMin?: number = 30;
}
