import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { MediaController } from './media.controller';

// Allowed MIME types and their WhatsApp-compatible extensions
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
};

export const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB — WhatsApp limit

@Module({
  imports: [
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            // Path: uploads/{tenantId}/{YYYY-MM}/
            const tenantId =
              (req.params as { tenantId?: string }).tenantId ?? 'unknown';
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const uploadPath = join(
              process.cwd(),
              config.get<string>('UPLOAD_DIR', 'uploads'),
              tenantId,
              month,
            );

            if (!existsSync(uploadPath)) {
              mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
          },
          filename: (_req, file, cb) => {
            // uuid + original extension — prevents collisions and path traversal
            const ext =
              extname(file.originalname).toLowerCase() ||
              ALLOWED_MIME_TYPES[file.mimetype] ||
              '';
            cb(null, `${uuidv4()}${ext}`);
          },
        }),

        fileFilter: (_req, file, cb) => {
          if (ALLOWED_MIME_TYPES[file.mimetype]) {
            cb(null, true);
          } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
          }
        },

        limits: {
          fileSize: MAX_FILE_SIZE,
          files: 1, // one file per request
        },
      }),
    }),
  ],
  controllers: [MediaController],
})
export class MediaModule {}
