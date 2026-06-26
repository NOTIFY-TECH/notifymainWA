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
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
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
  @Patch(':campaignId')
  @ApiOperation({ summary: 'Edit a draft or scheduled campaign' })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  updateCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.updateCampaign(tenantId, campaignId, dto);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/launch
  @Post(':campaignId/launch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Launch a draft campaign (starts sending)' })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  launchCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.launchCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/contacts
  @Post(':campaignId/contacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Add recipients to a draft/scheduled campaign via contactIds or tags',
  })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
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
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  cancelCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.cancelCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/retry-failed
  @Post(':campaignId/retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry only the failed recipients of a completed campaign',
  })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  retryFailedCampaign(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.campaignsService.retryFailedCampaign(tenantId, campaignId);
  }

  // POST /tenants/:tenantId/campaigns/:campaignId/clone
  @Post(':campaignId/clone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clone a campaign as a new draft with no contacts attached',
  })
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
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
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async importRecipientsCsv(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @UploadedFile() file: Express.Multer.File,
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
