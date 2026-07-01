import { Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';

@ApiTags('Payroll Webhooks')
@Controller('payroll/webhooks')
export class PayrollWebhooksController {
  private readonly logger = new Logger(PayrollWebhooksController.name);

  @Post('nomba')
  @Public()
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({ summary: 'Deprecated — use /webhooks/nomba' })
  handleNombaWebhookMoved() {
    this.logger.warn('Legacy /payroll/webhooks/nomba called — use /webhooks/nomba');
    return {
      received: false,
      message: 'Use POST /api/v1/webhooks/nomba',
    };
  }
}
