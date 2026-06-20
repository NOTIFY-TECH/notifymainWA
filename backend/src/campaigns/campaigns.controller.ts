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
  Patch,
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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AddCampaignContactsDto } from './dto/add-campaign-contacts.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

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
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('tenants/:tenantId/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // GET /tenants/:tenantId/campaigns
  @Get()
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  listCampaigns(
    @Param('tenantId') tenantId: string,
    @Query() query: ListCampaignsDto,
  ) {
    return this.campaignsService.listCampaigns(tenantId, query);
  }

  // POST /tenants/:tenantId/campaigns
  @Post()
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  createCampaign(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateCampaignDto,
    @Req() req: any,
  ) {
    return this.campaignsService.createCampaign(tenantId, req.user.userId, dto);
  }

  // GET /tenants/:tenantId/campaigns/:campaignId
  @Get(':campaignId')
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  getCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.getCampaign(tenantId, campaignId);
  }

  // PATCH /tenants/:tenantId/campaigns/:campaignId
  //
  // Edits a DRAFT/SCHEDULED campaign's message, media, session, schedule,
  // or rate limit. Recipients are NOT editable here — use POST :campaignId/contacts
  // or the CSV endpoint for that.
  @Patch(':campaignId')
  @ApiOperation({ summary: 'Edit a draft or scheduled campaign' })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  updateCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.updateCampaign(tenantId, campaignId, dto);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/launch
  //
  // Starts sending a DRAFT/SCHEDULED campaign that has at least one
  // recipient attached. See CampaignsService.launchCampaign for the
  // immediate-vs-scheduled branching logic.
  @Post(':campaignId/launch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Launch a draft campaign (starts sending)' })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  launchCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.launchCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/contacts
  //
  // Adds recipients to an existing DRAFT/SCHEDULED campaign via contactIds
  // and/or tags — reuses the same resolution logic as createCampaign
  // (CampaignsService.resolveRecipients). For CSV-based addition, use the
  // existing POST :campaignId/recipients/csv endpoint instead.
  //
  // NOTE: this route was previously missing from the controller — the
  // service method (addContactsToCampaign) existed but had no route wired
  // to it, causing a framework-level 404 ("Cannot POST .../contacts") on
  // every campaign, not just cloned ones.
  @Post(':campaignId/contacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Add recipients to a draft/scheduled campaign via contactIds or tags',
  })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  addContacts(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: AddCampaignContactsDto,
  ) {
    return this.campaignsService.addContactsToCampaign(
      tenantId,
      campaignId,
      dto,
    );
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/cancel
  @Post(':campaignId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  cancelCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.cancelCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/retry-failed
  //
  // Re-queues only the FAILED CampaignContact rows for a fresh send attempt.
  // Only valid from COMPLETED status — see CampaignsService.retryFailedCampaign
  // for the full reasoning on that restriction.
  @Post(':campaignId/retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry only the failed recipients of a completed campaign',
  })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  retryFailedCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.retryFailedCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/clone
  //
  // Copies name/messageTemplate/mediaUrl/sessionId into a new DRAFT campaign
  // with zero contacts. req.user.userId becomes the clone's createdById —
  // matches the same field used in createCampaign above, not copied from
  // the original campaign's creator.
  @Post(':campaignId/clone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clone a campaign as a new draft with no contacts attached',
  })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  cloneCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
    @Req() req: any,
  ) {
    return this.campaignsService.cloneCampaign(
      tenantId,
      campaignId,
      req.user.userId,
    );
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
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
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
