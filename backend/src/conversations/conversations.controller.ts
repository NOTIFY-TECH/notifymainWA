import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants/:tenantId/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // GET /tenants/:tenantId/conversations
  @Get()
  async listConversations(
    @Param('tenantId') tenantId: string,
    @Query() query: ListConversationsDto,
  ) {
    return this.conversationsService.listConversations(tenantId, query);
  }

  // GET /tenants/:tenantId/conversations/:conversationId
  @Get(':conversationId')
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
  async markAsRead(
    @Param('tenantId') tenantId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.markAsRead(tenantId, conversationId);
  }
}
