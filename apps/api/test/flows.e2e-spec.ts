import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, uniqueEmail } from './e2e-bootstrap';

describe('Tenant flows (e2e)', () => {
  let app: INestApplication;
  const password = 'password123';

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, completes onboarding, and returns trial subscription', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = uniqueEmail('onboard');

    const registerRes = await agent
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    const token = registerRes.body.accessToken as string;
    const withAuth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    const onboarding = await withAuth(agent.post('/api/v1/onboarding/complete'))
      .send({
        name: `E2E Workspace ${Date.now()}`,
        industry: 'Technology',
        companySize: '1-10',
        businessCountry: 'NG',
      })
      .expect(201);

    expect(onboarding.body.tenant).toHaveProperty('id');
    expect(onboarding.body.subscription?.status).toBe('TRIAL');
    expect(onboarding.body.pricingRegion?.countryCode).toBe('NG');

    const tenants = await withAuth(agent.get('/api/v1/tenants/user/me?limit=10')).expect(200);
    expect(tenants.body.records?.length).toBeGreaterThan(0);

    const tenantId = onboarding.body.tenant.id as string;
    const billing = await withAuth(
      agent.get(`/api/v1/subscriptions/tenant/${tenantId}/billing-status`),
    ).expect(200);

    expect(billing.body.paymentsEnabled).toBe(false);
    expect(billing.body.subscription?.plan).toBeDefined();
  });
});
