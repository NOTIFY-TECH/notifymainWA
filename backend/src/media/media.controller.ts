import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './media.module';
import { join, relative } from 'path';

export interface UploadedMediaResponse {
  url: string; // full public URL — e.g. http://localhost:3001/uploads/...
  path: string; // relative path — for storage reference
  filename: string; // uuid filename
  originalName: string;
  mediaType: string; // MIME type
  size: number; // bytes
}

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('tenants/:tenantId/media')
export class MediaController {
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a media file (image / video / PDF / audio)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  upload(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { tenantId: string } },
  ): UploadedMediaResponse {
    // Guard: file must be present
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // NOTE: TenantGuard now enforces tenant-match centrally (added session 7,
    // RBAC rollout). This manual check is kept as defense-in-depth since it
    // was already here and costs nothing, but TenantGuard is the source of truth.
    if (req.user.tenantId !== tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }

    // Guard: double-check MIME (Multer fileFilter already rejects, but be explicit)
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`,
      );
    }

    // Guard: size (Multer limits already enforce, but surface a clean message)
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Build public URL — served by ServeStaticModule registered in AppModule (0D)
    const uploadsRoot = join(process.cwd(), 'uploads');
    const relativePath = relative(uploadsRoot, file.path).replace(/\\/g, '/');
    const baseUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
    const url = `${baseUrl}/uploads/${relativePath}`;

    return {
      url,
      path: relativePath,
      filename: file.filename,
      originalName: file.originalname,
      mediaType: file.mimetype,
      size: file.size,
    };
  }
}
