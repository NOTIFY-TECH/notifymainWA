import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUrl,
} from 'class-validator';

export class CreateCampaignTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  messageBody: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mediaType?: string;
}
