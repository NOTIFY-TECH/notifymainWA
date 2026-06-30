import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsOptional } from 'class-validator';

class ReactToMessageDto {
  @IsString()
  emoji: string; // empty string = remove reaction
}

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('tenants/:tenantId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async sendMessage(
    @Param('tenantId') tenantId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.sendMessage(tenantId, user.userId, dto);
  }

  @Get()
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async listMessages(
    @Param('tenantId') tenantId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.messagesService.listMessages(tenantId, query);
  }

  // POST /tenants/:tenantId/messages/:messageId/react
  @Post(':messageId/react')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.AGENT)
  async reactToMessage(
    @Param('tenantId') tenantId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReactToMessageDto,
  ) {
    return this.messagesService.reactToMessage(tenantId, messageId, dto.emoji);
  }
}
