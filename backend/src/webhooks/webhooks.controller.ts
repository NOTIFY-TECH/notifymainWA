import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { EngineWebhookDto } from './dto/engine-webhook.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('engine')
  @HttpCode(HttpStatus.OK)
  async receiveEngineEvent(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: EngineWebhookDto,
  ) {
    this.webhooksService.validateApiKey(apiKey);
    return this.webhooksService.handleEngineEvent(dto);
  }
}
