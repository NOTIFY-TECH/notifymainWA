import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  sessionId: string;

  @IsString()
  @MaxLength(20)
  to: string; // WhatsApp number e.g. 919876543210

  @IsIn(['text', 'image', 'document', 'audio', 'video'])
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  text?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mediaType?: string; // MIME type — e.g. 'image/jpeg', 'video/mp4', 'application/pdf'

  @IsOptional()
  @IsString()
  conversationId?: string;
}
