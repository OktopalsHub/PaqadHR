import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SubscriptionStatus } from '../src/common/enums/subscription.enum';
import { TenantSubscription } from '../src/modules/v1/subscriptions/entities/tenant-subscription.entity';
import { calculatePerSeatTotal } from '../src/modules/v1/subscriptions/utils/per-seat-pricing.util';
import { createE2eApp } from './e2e-bootstrap';
import {
  buildNombaPaymentWebhook,
  onboardTenant,
  registerUser,
  signNombaWebhook,
} from './e2e-helpers';

describe('Subscription webhooks (e2e)', () => {
  const webhookSecret = 'e2e-nomba-webhook-secret';
  const originalWebhookSecret = process.env.NOMBA_WEBHOOK_SIGNATURE_KEY;

  let app: INestApplication;

  beforeAll(async () => {
    process.env.NOMBA_WEBHOOK_SIGNATURE_KEY = webhookSecret;
    app = await createE2eApp({ withRateLimit: true });
  });

  afterAll(async () => {
    process.env.NOMBA_WEBHOOK_SIGNATURE_KEY = originalWebhookSecret;
    await app.close();
  });

  it('rejects webhooks without raw body middleware', async () => {
    const bareApp = await createE2eApp();
    try {
      await request(bareApp.getHttpServer())
        .post('/api/v1/subscriptions/webhooks/nomba')
        .send({ event_type: 'payment_success' })
        .expect(401);
    } finally {
      await bareApp.close();
    }
  });

  it('rejects invalid signatures', async () => {
    const rawBody = buildNombaPaymentWebhook({
      tenantId: '00000000-0000-4000-8000-000000000001',
      planId: '00000000-0000-4000-8000-000000000002',
      planPriceId: '00000000-0000-4000-8000-000000000003',
      reference: 'e2e_verify_1000',
      amount: 1000,
    });

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('x-nomba-signature', 'invalid')
      .send(rawBody)
      .expect(401);
  });

  it('activates subscription on signed payment_success webhook', async () => {
    const auth = await registerUser(app, 'sub-webhook', 'password123', { useCsrf: true });
    const tenant = await onboardTenant(auth, undefined, { useCsrf: true });

    const dataSource = app.get(DataSource);
    const subscription = await dataSource.getRepository(TenantSubscription).findOne({
      where: { tenantId: tenant.tenantId },
      relations: ['planPrice'],
    });
    expect(subscription).toBeTruthy();

    const seatCount = 1;
    const amount = calculatePerSeatTotal(subscription!.planPrice, seatCount);
    const reference = `e2e_verify_${amount}`;
    const tokenKey = 'tok_e2e_test';
    const rawBody = buildNombaPaymentWebhook({
      tenantId: tenant.tenantId,
      planId: subscription!.planId,
      planPriceId: subscription!.planPriceId,
      reference,
      amount,
      quantity: seatCount,
      tokenKey,
      eventId: `evt_${tenant.tenantId}_${reference}`,
    });
    const signature = signNombaWebhook(rawBody, webhookSecret);

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('x-nomba-signature', signature)
      .send(rawBody)
      .expect(200)
      .expect({ received: true });

    const updated = await dataSource.getRepository(TenantSubscription).findOneBy({
      tenantId: tenant.tenantId,
    });
    expect(updated?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(updated?.paymentMethodId).toBe(tokenKey);
    expect(updated?.nombaSubscriptionId).toBe(reference);

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('x-nomba-signature', signature)
      .send(rawBody)
      .expect(200);

    const afterReplay = await dataSource.getRepository(TenantSubscription).findOneBy({
      tenantId: tenant.tenantId,
    });
    expect(afterReplay?.status).toBe(SubscriptionStatus.ACTIVE);
  });
});
