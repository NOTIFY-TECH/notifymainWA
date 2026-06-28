import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('tenants/:tenantId/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // GET /tenants/:tenantId/conversations
  @Get()
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  async listConversations(
    @Param('tenantId') tenantId: string,
    @Query() query: ListConversationsDto,
  ) {
    return this.conversationsService.listConversations(tenantId, query);
  }

  // GET /tenants/:tenantId/conversations/:conversationId
  @Get(':conversationId')
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  async getConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getConversation(tenantId, conversationId);
  }

  // GET /tenants/:tenantId/conversations/:conversationId/messages
  @Get(':conversationId/messages')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  @Roles(
    UserRole.TENANT_OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.AGENT,
    UserRole.VIEWER,
  )
  async getMessages(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.conversationsService.getMessages(
      tenantId,
      conversationId,
      limit ? Number(limit) : 30,
      before,
    );
  }

  // POST /tenants/:tenantId/conversations/:conversationId/read
  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async markAsRead(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.markAsRead(tenantId, conversationId);
  }

  // PATCH /tenants/:tenantId/conversations/:conversationId/pin
  @Patch(':conversationId/pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async pinConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.pinConversation(tenantId, conversationId);
  }

  // PATCH /tenants/:tenantId/conversations/:conversationId/unpin
  @Patch(':conversationId/unpin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async unpinConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.unpinConversation(
      tenantId,
      conversationId,
    );
  }

  // PATCH /tenants/:tenantId/conversations/:conversationId/archive
  @Patch(':conversationId/archive')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async archiveConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.archiveConversation(
      tenantId,
      conversationId,
    );
  }

  // PATCH /tenants/:tenantId/conversations/:conversationId/unarchive
  @Patch(':conversationId/unarchive')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async unarchiveConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.unarchiveConversation(
      tenantId,
      conversationId,
    );
  }

  // PATCH /tenants/:tenantId/conversations/:conversationId/assign
  // Session 27: new endpoint backing the Inbox — assign conversations matrix
  // row. Owner/Admin only, per the matrix — Agents can be assignees but
  // cannot perform the assignment themselves.
  // Body: { userId: string | null } — null/omitted unassigns.
  @Patch(':conversationId/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN)
  async assignConversation(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.conversationsService.assignConversation(
      tenantId,
      conversationId,
      dto,
    );
  }
}
