import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type {
  SlackEventPayload,
  SlackInteractiveBody,
  SlackSlashCommandPayload,
  SlackUrlVerificationPayload,
} from '../integration.types';
import type { SlackWebhookService } from '../services/slack-webhook.service';

@ApiTags('Slack Webhooks')
@Controller('webhooks/slack')
export class SlackWebhookController {
  constructor(private readonly slackWebhookService: SlackWebhookService) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
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
      return { error: 'Invalid signature' };
    }
    if ('challenge' in body) {
      return { challenge: body.challenge };
    }
    await this.slackWebhookService.handleSlackEvent(body);
    return { ok: true };
  }

  @Post('interactive')
  @HttpCode(HttpStatus.OK)
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
      return { error: 'Invalid signature' };
    }
    const payload = JSON.parse(body.payload);
    await this.slackWebhookService.handleInteractiveComponent(payload);
    return { ok: true };
  }

  @Post('slash-commands')
  @HttpCode(HttpStatus.OK)
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
      return { error: 'Invalid signature' };
    }
    const response = await this.slackWebhookService.handleSlashCommand(body);
    return response;
  }
}
