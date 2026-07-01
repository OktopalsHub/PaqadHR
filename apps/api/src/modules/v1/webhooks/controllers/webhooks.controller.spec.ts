import { createHmac } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ReloadlyWebhookService } from '../../rewards/services/reloadly-webhook.service';
import { SlackWebhookService } from '../../shoutouts/services/slack-webhook.service';
import { NombaWebhookService } from '../services/nomba-webhook.service';
import { WebhooksController } from './webhooks.controller';

jest.mock('src/common/config/nomba-webhook.util', () => ({
  verifyNombaWebhookSignature: jest.fn(),
}));

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockNombaWebhookService: jest.Mocked<Pick<NombaWebhookService, 'dispatch'>>;
  let mockReloadlyWebhookService: jest.Mocked<
    Pick<ReloadlyWebhookService, 'processReloadlyWebhookEvent'>
  >;
  let mockSlackWebhookService: jest.Mocked<Pick<SlackWebhookService, 'verifySlackSignature'>>;

  const webhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    process.env.RELOADLY_WEBHOOK_SECRET = webhookSecret;

    mockNombaWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockReloadlyWebhookService = {
      processReloadlyWebhookEvent: jest.fn().mockResolvedValue(undefined),
    };
    mockSlackWebhookService = { verifySlackSignature: jest.fn() };

    controller = new WebhooksController(
      mockNombaWebhookService as unknown as NombaWebhookService,
      mockReloadlyWebhookService as unknown as ReloadlyWebhookService,
      mockSlackWebhookService as unknown as SlackWebhookService,
    );
  });

  afterEach(() => {
    delete process.env.RELOADLY_WEBHOOK_SECRET;
  });

  describe('handleNombaWebhook', () => {
    it('delegates to NombaWebhookService', async () => {
      const req = { rawBody: Buffer.from('{}') } as any;
      const result = await controller.handleNombaWebhook(req, { 'nomba-signature': 'sig' });

      expect(mockNombaWebhookService.dispatch).toHaveBeenCalledWith('{}', 'sig');
      expect(result).toEqual({ received: true });
    });

    it('rejects missing raw body', () => {
      expect(() => controller.handleNombaWebhook({} as any, {})).toThrow(UnauthorizedException);
    });
  });

  describe('handleReloadlyWebhook', () => {
    it('should throw UnauthorizedException if RELOADLY_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.RELOADLY_WEBHOOK_SECRET;
      const req = { rawBody: Buffer.from('{}') } as any;

      await expect(controller.handleReloadlyWebhook(req, 'some-signature')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if signature header is missing', async () => {
      const req = { rawBody: Buffer.from('{}') } as any;

      await expect(controller.handleReloadlyWebhook(req, '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if signatures do not match', async () => {
      const req = { rawBody: Buffer.from('{}') } as any;

      await expect(controller.handleReloadlyWebhook(req, 'bad-sig')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify signature, process event, and return received: true', async () => {
      const payload = { test: true };
      const rawBodyString = JSON.stringify(payload);
      const req = { rawBody: Buffer.from(rawBodyString) } as any;
      const signature = createHmac('sha256', webhookSecret).update(rawBodyString).digest('hex');

      const result = await controller.handleReloadlyWebhook(req, signature);

      expect(result).toEqual({ received: true });
      expect(mockReloadlyWebhookService.processReloadlyWebhookEvent).toHaveBeenCalledWith(payload);
    });

    it('should throw BadRequestException if JSON is invalid', async () => {
      const rawBodyString = '{invalid-json';
      const req = { rawBody: Buffer.from(rawBodyString) } as any;
      const signature = createHmac('sha256', webhookSecret).update(rawBodyString).digest('hex');

      await expect(controller.handleReloadlyWebhook(req, signature)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
