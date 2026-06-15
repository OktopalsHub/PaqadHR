import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';
@ApiTags('Payment Webhooks')
@Controller('webhooks')
@Public()
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nomba webhook stub' })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged' })
  handleNombaWebhook(
    @Headers('x-nomba-signature') _signature: string,
    @Body() body: { event?: string; eventType?: string },
  ) {
    this.logger.warn(`Nomba webhook stub received: ${body.event ?? body.eventType ?? 'unknown'}`);
    return { received: true, stub: true };
  }
}
