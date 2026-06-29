import { Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';

@ApiTags('Payment Webhooks')
@Controller('webhooks')
@Public()
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  @Post('nomba')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ summary: 'Deprecated — use /subscriptions/webhooks/nomba' })
  @ApiResponse({ status: 410, description: 'Endpoint moved' })
  handleNombaWebhookMoved() {
    this.logger.warn('Legacy /webhooks/nomba called — use /subscriptions/webhooks/nomba');
    return {
      received: false,
      message: 'Use POST /api/v1/subscriptions/webhooks/nomba',
    };
  }
}
