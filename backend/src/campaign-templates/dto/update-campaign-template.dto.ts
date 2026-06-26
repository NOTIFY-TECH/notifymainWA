import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class UpdateCampaignTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  messageBody?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mediaType?: string | null;
}
