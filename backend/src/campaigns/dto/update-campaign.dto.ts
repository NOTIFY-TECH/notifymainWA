import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// All fields optional — PATCH semantics, only provided fields are updated.
// contactIds/tags are intentionally NOT here: once a campaign exists,
// recipients are managed via POST :campaignId/contacts (AddCampaignContactsDto)
// or the CSV endpoint, not through this edit form.
export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiPropertyOptional({
    description:
      'URL to send as a separate plain-text message after the media+caption so ' +
      'WhatsApp renders it as a link-preview card. Set to null to clear an existing value.',
  })
  @IsOptional()
  @IsString()
  linkUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'Set to null to clear an existing schedule and make the campaign send-on-launch',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @ApiPropertyOptional({ minimum: 10, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(60)
  rateLimitPerMin?: number;
}
