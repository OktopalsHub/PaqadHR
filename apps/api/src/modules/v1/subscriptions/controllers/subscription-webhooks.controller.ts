import { Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, RateLimit, RateLimitPresets } from 'src/common/decorators';

@ApiTags('Subscription Webhooks')
@Controller('subscriptions/webhooks')
export class SubscriptionWebhooksController {
  private readonly logger = new Logger(SubscriptionWebhooksController.name);

  @Post('nomba')
  @Public()
  @RateLimit(RateLimitPresets.PUBLIC)
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ summary: 'Deprecated — use /webhooks/nomba' })
  handleNombaWebhookMoved() {
    this.logger.warn('Legacy /subscriptions/webhooks/nomba called — use /webhooks/nomba');
    return {
      received: false,
      message: 'Use POST /api/v1/webhooks/nomba',
    };
  }
}
