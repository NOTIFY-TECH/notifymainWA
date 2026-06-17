import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { ImportRecipientsDto } from './dto/import-recipients.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

// Accepted MIME types for the CSV upload endpoint.
// Browsers and OS file pickers may send either of these for .csv files
// depending on platform — both must be accepted.
const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel', // Windows sends this for .csv
  'text/plain', // some Linux/macOS pickers send this
]);

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — generous for a phone-number-only CSV

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // GET /tenants/:tenantId/campaigns
  @Get()
  listCampaigns(
    @Param('tenantId') tenantId: string,
    @Query() query: ListCampaignsDto,
  ) {
    return this.campaignsService.listCampaigns(tenantId, query);
  }

  // POST /tenants/:tenantId/campaigns
  @Post()
  createCampaign(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateCampaignDto,
    @Req() req: any,
  ) {
    return this.campaignsService.createCampaign(tenantId, req.user.userId, dto);
  }

  // GET /tenants/:tenantId/campaigns/:campaignId
  @Get(':campaignId')
  getCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.getCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/cancel
  @Post(':campaignId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.cancelCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/recipients/csv
  //
  // Accepts a multipart/form-data request with a single 'file' field
  // containing a .csv file. Parses the phoneNumber column and creates
  // CampaignContact rows for the given campaign.
  //
  // Uses memoryStorage so the CSV buffer is available directly without
  // writing to disk — consistent with how ContactsService.importContacts
  // receives its buffer. The MediaModule's disk-storage multer config is
  // NOT shared here by design.
  @Post(':campaignId/recipients/csv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload a CSV file of recipient phone numbers for a campaign',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_CSV_SIZE_BYTES },
    }),
  )
  async importRecipientsCsv(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @UploadedFile() file: Express.Multer.File,
    // ImportRecipientsDto referenced here only to attach the Swagger
    // file-field descriptor — NestJS ApiBody picks it up via @ApiConsumes above.

    @Body() _body: ImportRecipientsDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send the CSV as a multipart field named "file".',
      );
    }

    if (!CSV_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Upload a .csv file.`,
      );
    }

    // file.size check is belt-and-suspenders — multer limits already enforce
    // MAX_CSV_SIZE_BYTES above, but surface a clean message just in case.
    if (file.size > MAX_CSV_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_CSV_SIZE_BYTES / 1024 / 1024}MB.`,
      );
    }

    return this.campaignsService.importCampaignRecipients(
      tenantId,
      campaignId,
      file.buffer,
    );
  }
}
