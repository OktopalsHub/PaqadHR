import { createHmac } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { RATE_LIMIT_KEY, RateLimitPresets } from 'src/common/decorators';

import { SlackWebhookService } from '../../shoutouts/services/slack-webhook.service';
import { BachsWebhookService } from '../services/bachs-webhook.service';
import { FincraWebhookService } from '../services/fincra-webhook.service';
import { MonnifyWebhookService } from '../services/monnify-webhook.service';
import { NoahWebhookService } from '../services/noah-webhook.service';
import { NombaWebhookService } from '../services/nomba-webhook.service';
import { TremendousWebhookService } from '../services/tremendous-webhook.service';
import { WebhooksController } from './webhooks.controller';

jest.mock('src/common/config/nomba-webhook.util', () => ({
  verifyNombaWebhookSignature: jest.fn(),
}));

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockNombaWebhookService: jest.Mocked<Pick<NombaWebhookService, 'dispatch'>>;
  let mockMonnifyWebhookService: jest.Mocked<Pick<MonnifyWebhookService, 'dispatch'>>;
  let mockNoahWebhookService: jest.Mocked<Pick<NoahWebhookService, 'dispatch'>>;
  let mockFincraWebhookService: jest.Mocked<Pick<FincraWebhookService, 'dispatch'>>;
  let mockBachsWebhookService: jest.Mocked<Pick<BachsWebhookService, 'dispatch'>>;
  let mockTremendousWebhookService: jest.Mocked<Pick<TremendousWebhookService, 'dispatch'>>;
  let mockSlackWebhookService: jest.Mocked<Pick<SlackWebhookService, 'verifySlackSignature'>>;

  beforeEach(() => {
    mockNombaWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockMonnifyWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockNoahWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockFincraWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockBachsWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockTremendousWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockSlackWebhookService = { verifySlackSignature: jest.fn() };

    controller = new WebhooksController(
      mockNombaWebhookService as unknown as NombaWebhookService,
      mockMonnifyWebhookService as unknown as MonnifyWebhookService,
      mockNoahWebhookService as unknown as NoahWebhookService,
      mockFincraWebhookService as unknown as FincraWebhookService,
      mockBachsWebhookService as unknown as BachsWebhookService,
      mockSlackWebhookService as unknown as SlackWebhookService,
      mockTremendousWebhookService as unknown as TremendousWebhookService,
      { capture: jest.fn() } as never,
      {} as never,
      {} as never,
    );
  });

  describe('handleNombaWebhook', () => {
    it('delegates to NombaWebhookService', async () => {
      const req = { rawBody: Buffer.from('{}') } as any;
      const result = await controller.handleNombaWebhook(req, { 'nomba-signature': 'sig' });

      expect(mockNombaWebhookService.dispatch).toHaveBeenCalledWith('{}', 'sig', '');
      expect(result).toEqual({ received: true });
    });

    it('rejects missing raw body', () => {
      expect(() => controller.handleNombaWebhook({} as any, {})).toThrow(UnauthorizedException);
    });
  });

  describe('handleTremendousWebhook', () => {
    const originalSecret = process.env.TREMENDOUS_WEBHOOK_SECRET;
    const body = '{"event_type":"REWARD_FULFILLMENT_FAILED"}';
    const req = { rawBody: Buffer.from(body) } as any;

    beforeEach(() => {
      process.env.TREMENDOUS_WEBHOOK_SECRET = 'tremendous-secret';
    });

    afterEach(() => {
      if (originalSecret === undefined) delete process.env.TREMENDOUS_WEBHOOK_SECRET;
      else process.env.TREMENDOUS_WEBHOOK_SECRET = originalSecret;
    });

    it('rejects a missing signature without dispatching', () => {
      expect(() => controller.handleTremendousWebhook(req, {})).toThrow(UnauthorizedException);
      expect(mockTremendousWebhookService.dispatch).not.toHaveBeenCalled();
    });

    it('rejects a forged signature without dispatching', () => {
      expect(() =>
        controller.handleTremendousWebhook(req, { 'tremendous-webhook-signature': 'forged' }),
      ).toThrow(UnauthorizedException);
      expect(mockTremendousWebhookService.dispatch).not.toHaveBeenCalled();
    });

    it('rejects every request when the secret is not configured', () => {
      delete process.env.TREMENDOUS_WEBHOOK_SECRET;
      const signature = createHmac('sha256', '').update(body).digest('hex');
      expect(() =>
        controller.handleTremendousWebhook(req, { 'tremendous-webhook-signature': signature }),
      ).toThrow(UnauthorizedException);
    });

    it('dispatches when the signature matches the raw body', async () => {
      const signature = createHmac('sha256', 'tremendous-secret').update(body).digest('hex');
      const result = await controller.handleTremendousWebhook(req, {
        'tremendous-webhook-signature': signature,
      });
      expect(mockTremendousWebhookService.dispatch).toHaveBeenCalledWith(body);
      expect(result).toEqual({ received: true });
    });
  });

  describe('handleMonnifyWebhook', () => {
    it('delegates to MonnifyWebhookService', async () => {
      const req = { rawBody: Buffer.from('{}') } as any;
      const result = await controller.handleMonnifyWebhook(req, {
        'x-monnify-signature': 'sig',
      });

      expect(mockMonnifyWebhookService.dispatch).toHaveBeenCalledWith('{}', 'sig');
      expect(result).toEqual({ received: true });
    });

    it('rejects missing raw body', () => {
      expect(() => controller.handleMonnifyWebhook({} as any, {})).toThrow(UnauthorizedException);
    });
  });

  describe('rate limiting', () => {
    it.each([
      ['nomba', WebhooksController.prototype.handleNombaWebhook],
      ['monnify', WebhooksController.prototype.handleMonnifyWebhook],
      ['noah', WebhooksController.prototype.handleNoahWebhook],
      ['fincra', WebhooksController.prototype.handleFincraWebhook],
      ['bachs', WebhooksController.prototype.handleBachsWebhook],
      ['tremendous', WebhooksController.prototype.handleTremendousWebhook],
      ['slack events', WebhooksController.prototype.handleSlackEvents],
      ['slack interactive', WebhooksController.prototype.handleSlackInteractive],
      ['slack slash commands', WebhooksController.prototype.handleSlashCommand],
    ])('rate limits the %s webhook endpoint', (_name, handler) => {
      expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler)).toEqual(RateLimitPresets.PUBLIC);
    });
  });
});
