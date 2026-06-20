import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Mirrors the contactIds/tags fields on CreateCampaignDto exactly — same
// validation rules, since both feed the same resolveRecipients() resolution
// logic in CampaignsService. Kept as a separate DTO (not a Pick<> of
// CreateCampaignDto) because this endpoint has no name/sessionId/etc and
// class-validator decorators don't survive TypeScript's Pick utility type.
export class AddCampaignContactsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Add all contacts having any of these tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
