import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/common/decorators';
import { PayrollPayoutService } from '../services/payroll-payout.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('Payroll Webhooks')
@Controller('payroll/webhooks')
export class PayrollWebhooksController {
  constructor(private readonly payrollPayoutService: PayrollPayoutService) {}

  @Post('nomba')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nomba payroll transfer webhook' })
  handleNombaWebhook(
    @Req() req: RawBodyRequest,
    @Headers('nomba-signature') signature: string,
    @Headers('nomba-sig-value') signatureAlt: string,
    @Headers('x-nomba-signature') signatureLegacy: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }

    return this.payrollPayoutService.handleNombaWebhook(
      rawBody,
      signature || signatureAlt || signatureLegacy || '',
    );
  }
}
