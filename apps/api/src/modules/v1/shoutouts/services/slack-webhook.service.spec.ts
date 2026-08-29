import * as crypto from 'node:crypto';

jest.mock('src/common/config/env.config', () => ({
  ENVIRONMENT: {
    SLACK: {
      SIGNING_SECRET: 'test-signing-secret',
    },
  },
}));

import { SlackWebhookService } from './slack-webhook.service';

describe('SlackWebhookService.verifySlackSignature', () => {
  const signingSecret = 'test-signing-secret';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = Buffer.from('token=gIvjoQK3S9%2F&team_id=T0001&team_domain=example');

  it('accepts a valid urlencoded payload signature', async () => {
    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const signature = `v0=${crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex')}`;

    const service = new SlackWebhookService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.verifySlackSignature(rawBody, signature, timestamp)).resolves.toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const service = new SlackWebhookService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.verifySlackSignature(rawBody, 'v0=deadbeef', timestamp),
    ).resolves.toBe(false);
  });
});
