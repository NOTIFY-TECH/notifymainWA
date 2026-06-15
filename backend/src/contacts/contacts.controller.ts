import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { ListContactsDto } from './dto/list-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AddTagDto } from './dto/add-tag.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import {
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  listContacts(
    @Param('tenantId') tenantId: string,
    @Query() query: ListContactsDto,
  ) {
    return this.contactsService.listContacts(tenantId, query);
  }

  @Post()
  createContact(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.createContact(tenantId, dto);
  }

  // ── Must be before :contactId routes to avoid param collision ──
  @Post('from-conversation/:conversationId')
  createFromConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.contactsService.createFromConversation(
      tenantId,
      conversationId,
    );
  }
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importContacts(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Only .csv files are accepted');
    }
    return this.contactsService.importContacts(tenantId, file.buffer);
  }

  @Get(':contactId')
  getContact(
    @Param('tenantId') tenantId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.getContact(tenantId, contactId);
  }

  @Patch(':contactId')
  updateContact(
    @Param('tenantId') tenantId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.updateContact(tenantId, contactId, dto);
  }

  @Post(':contactId/tags')
  addTag(
    @Param('tenantId') tenantId: string,
    @Param('contactId') contactId: string,
    @Body() dto: AddTagDto,
  ) {
    return this.contactsService.addTag(tenantId, contactId, dto);
  }

  @Delete(':contactId/tags/:tag')
  @HttpCode(HttpStatus.OK)
  removeTag(
    @Param('tenantId') tenantId: string,
    @Param('contactId') contactId: string,
    @Param('tag') tag: string,
  ) {
    return this.contactsService.removeTag(tenantId, contactId, tag);
  }

  @Delete(':contactId')
  @HttpCode(HttpStatus.OK)
  deleteContact(
    @Param('tenantId') tenantId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.deleteContact(tenantId, contactId);
  }
}
