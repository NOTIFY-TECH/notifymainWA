import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { ListContactsDto } from './dto/list-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // GET /tenants/:tenantId/contacts
  @Get()
  async listContacts(
    @Param('tenantId') tenantId: string,
    @Query() query: ListContactsDto,
  ) {
    return this.contactsService.listContacts(tenantId, query);
  }

  // POST /tenants/:tenantId/contacts
  @Post()
  async createContact(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.createContact(tenantId, dto);
  }
}
