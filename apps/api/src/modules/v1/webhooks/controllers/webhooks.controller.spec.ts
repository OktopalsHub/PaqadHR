import { UnauthorizedException } from '@nestjs/common';
import { TremendousWebhookService } from '../services/tremendous-webhook.service';
import { SlackWebhookService } from '../../shoutouts/services/slack-webhook.service';
import { BachsWebhookService } from '../services/bachs-webhook.service';
import { MonnifyWebhookService } from '../services/monnify-webhook.service';
import { NoahWebhookService } from '../services/noah-webhook.service';
import { NombaWebhookService } from '../services/nomba-webhook.service';
import { PolarWebhookService } from '../services/polar-webhook.service';
import { WebhooksController } from './webhooks.controller';

jest.mock('src/common/config/nomba-webhook.util', () => ({
  verifyNombaWebhookSignature: jest.fn(),
}));

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockNombaWebhookService: jest.Mocked<Pick<NombaWebhookService, 'dispatch'>>;
  let mockMonnifyWebhookService: jest.Mocked<Pick<MonnifyWebhookService, 'dispatch'>>;
  let mockNoahWebhookService: jest.Mocked<Pick<NoahWebhookService, 'dispatch'>>;
  let mockBachsWebhookService: jest.Mocked<Pick<BachsWebhookService, 'dispatch'>>;
  let mockPolarWebhookService: jest.Mocked<Pick<PolarWebhookService, 'dispatch'>>;
  let mockTremendousWebhookService: jest.Mocked<Pick<TremendousWebhookService, 'dispatch'>>;
  let mockSlackWebhookService: jest.Mocked<Pick<SlackWebhookService, 'verifySlackSignature'>>;

  beforeEach(() => {
    mockNombaWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockMonnifyWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockNoahWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockBachsWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockPolarWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockTremendousWebhookService = { dispatch: jest.fn().mockResolvedValue({ received: true }) };
    mockSlackWebhookService = { verifySlackSignature: jest.fn() };

    controller = new WebhooksController(
      mockNombaWebhookService as unknown as NombaWebhookService,
      mockMonnifyWebhookService as unknown as MonnifyWebhookService,
      mockNoahWebhookService as unknown as NoahWebhookService,
      mockBachsWebhookService as unknown as BachsWebhookService,
      mockPolarWebhookService as unknown as PolarWebhookService,
      mockTremendousWebhookService as unknown as TremendousWebhookService,
      mockSlackWebhookService as unknown as SlackWebhookService,
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
});
