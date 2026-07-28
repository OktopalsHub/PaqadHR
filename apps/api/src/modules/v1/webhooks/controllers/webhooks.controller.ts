import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { getReloadlyWebhookSecret } from 'src/common/config/reloadly.config';
import { Public } from 'src/common/decorators';
import type {
  SlackEventPayload,
  SlackInteractiveBody,
  SlackSlashCommandPayload,
  SlackUrlVerificationPayload,
} from 'src/common/integrations/integration.types';
import { ReloadlyWebhookService } from '../../rewards/services/reloadly-webhook.service';
import { SlackWebhookService } from '../../shoutouts/services/slack-webhook.service';
import { BachsWebhookService } from '../services/bachs-webhook.service';
import { NoahWebhookService } from '../services/noah-webhook.service';
import { NombaWebhookService } from '../services/nomba-webhook.service';
import { PolarWebhookService } from '../services/polar-webhook.service';
import {
  getNombaRawBody,
  resolveNoahSignature,
  resolveNombaSignature,
  resolveNombaTimestamp,
} from '../webhook-request.util';

type RawBodyRequestType = Request & { rawBody?: Buffer };

@ApiTags('Global Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly nombaWebhookService: NombaWebhookService,
    private readonly noahWebhookService: NoahWebhookService,
    private readonly bachsWebhookService: BachsWebhookService,
    private readonly polarWebhookService: PolarWebhookService,
    private readonly reloadlyWebhookService: ReloadlyWebhookService,
    private readonly slackWebhookService: SlackWebhookService,
  ) {}

  @Post('nomba')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nomba payment webhook (subscriptions, payroll, wallet funding)' })
  handleNombaWebhook(@Req() req: RawBodyRequestType, @Headers() headers: Record<string, string>) {
    const rawBody = getNombaRawBody(req);
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    return this.nombaWebhookService.dispatch(
      rawBody,
      resolveNombaSignature(headers),
      resolveNombaTimestamp(headers),
    );
  }

  @Post('noah')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Noah payment webhook (payroll payouts, wallet funding)' })
  handleNoahWebhook(@Req() req: RawBodyRequestType, @Headers() headers: Record<string, string>) {
    const rawBody = getNombaRawBody(req);
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    return this.noahWebhookService.dispatch(rawBody, resolveNoahSignature(headers));
  }

  @Post('bachs')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bachs billing webhook (subscriptions)' })
  handleBachsWebhook(@Req() req: RawBodyRequestType, @Headers() headers: Record<string, string>) {
    const rawBody = getNombaRawBody(req);
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    return this.bachsWebhookService.dispatch(
      rawBody,
      headers['x-bachs-signature'] ?? headers['X-Bachs-Signature'] ?? '',
      headers['x-bachs-timestamp'] ?? headers['X-Bachs-Timestamp'] ?? '',
    );
  }

  @Post('polar')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Polar billing webhook (subscriptions)' })
  handlePolarWebhook(@Req() req: RawBodyRequestType, @Headers() headers: Record<string, string>) {
    const rawBody = getNombaRawBody(req);
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    return this.polarWebhookService.dispatch(rawBody, headers);
  }

  @Post('reloadly')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reloadly transaction status webhook' })
  async handleReloadlyWebhook(
    @Req() req: RawBodyRequestType,
    @Headers('x-reloadly-signature') signature: string,
  ) {
    const secret = getReloadlyWebhookSecret();
    if (!secret) {
      this.logger.warn('RELOADLY_WEBHOOK_SECRET is not configured. Webhook validation skipped.');
      throw new UnauthorizedException('Reloadly webhook signature secret is not configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing Reloadly signature');
    }

    const rawBody = req.rawBody?.toString('utf8') ?? '';
    try {
      const hash = createHmac('sha256', secret).update(rawBody).digest('hex');
      const sigBuffer = Buffer.from(signature, 'utf8');
      const digestBuffer = Buffer.from(hash, 'utf8');
      if (sigBuffer.length !== digestBuffer.length || !timingSafeEqual(sigBuffer, digestBuffer)) {
        throw new UnauthorizedException('Invalid Reloadly signature');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Reloadly signature verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Reloadly signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    await this.reloadlyWebhookService.processReloadlyWebhookEvent(
      payload as Record<string, unknown>,
    );
    return { received: true };
  }

  @Post('slack/events')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack events webhook' })
  async handleSlackEvents(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @Body() body: SlackUrlVerificationPayload | SlackEventPayload,
  ) {
    const isValid = await this.slackWebhookService.verifySlackSignature(
      req.rawBody || Buffer.from(''),
      headers['x-slack-signature'],
      headers['x-slack-request-timestamp'],
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    if ('challenge' in body) {
      return { challenge: body.challenge };
    }
    await this.slackWebhookService.handleSlackEvent(body);
    return { ok: true };
  }

  @Post('slack/interactive')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack interactive components webhook' })
  async handleSlackInteractive(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @Body() body: SlackInteractiveBody,
  ) {
    const isValid = await this.slackWebhookService.verifySlackSignature(
      req.rawBody || Buffer.from(''),
      headers['x-slack-signature'],
      headers['x-slack-request-timestamp'],
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body.payload);
    } catch {
      throw new BadRequestException('Malformed Slack payload');
    }
    await this.slackWebhookService.handleInteractiveComponent(payload);
    return { ok: true };
  }

  @Post('slack/slash-commands')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack slash commands webhook' })
  async handleSlashCommand(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @Body() body: SlackSlashCommandPayload,
  ) {
    const isValid = await this.slackWebhookService.verifySlackSignature(
      req.rawBody || Buffer.from(''),
      headers['x-slack-signature'],
      headers['x-slack-request-timestamp'],
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    return this.slackWebhookService.handleSlashCommand(body);
  }
}
