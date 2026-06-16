import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/common/decorators';
import { SubscriptionBillingService } from '../services/subscription-billing.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('Subscription Webhooks')
@Controller('subscriptions/webhooks')
export class SubscriptionWebhooksController {
  constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

  @Post('nomba')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nomba subscription payment webhook' })
  handleNombaWebhook(
    @Req() req: RawBodyRequest,
    @Headers('x-nomba-signature') signature: string,
    @Headers('X-Nomba-Signature') signatureAlt: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }

    return this.subscriptionBillingService.handleNombaWebhook(
      rawBody,
      signature || signatureAlt || '',
    );
  }
}
