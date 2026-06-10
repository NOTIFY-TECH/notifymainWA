import { ApiProperty } from '@nestjs/swagger';

// Used only for Swagger documentation — Multer handles the actual parsing
export class UploadMediaDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'File to upload. Max 16MB. Allowed: jpeg, png, webp, mp4, pdf, mp3, ogg',
  })
  file: Express.Multer.File;
}
