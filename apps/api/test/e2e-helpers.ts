import type { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import request, { type Test } from 'supertest';
import { uniqueEmail } from './e2e-bootstrap';

export type E2eAuthContext = {
  agent: ReturnType<typeof request.agent>;
  token: string;
  email: string;
  password: string;
  withAuth: (req: Test) => Test;
};

export type E2eTenantContext = E2eAuthContext & {
  tenantId: string;
  ownerMemberId: string;
};

export type E2eRequestOptions = {
  /** Required when the app boots with ExpressSetup (CSRF + rawBody middleware). */
  useCsrf?: boolean;
};

async function csrfHeaders(
  agent: ReturnType<typeof request.agent>,
): Promise<Record<string, string>> {
  const csrf = await agent.get('/csrf/token').expect(200);
  return { 'X-CSRF-Token': csrf.body.csrfToken as string };
}

export async function registerUser(
  app: INestApplication,
  prefix: string,
  password = 'password123',
  options?: E2eRequestOptions,
): Promise<E2eAuthContext> {
  const agent = request.agent(app.getHttpServer());
  const email = uniqueEmail(prefix);
  const headers = options?.useCsrf ? await csrfHeaders(agent) : {};
  const registerRes = await agent
    .post('/api/v1/auth/register')
    .set(headers)
    .send({ email, password })
    .expect(201);

  const token = registerRes.body.accessToken as string;
  const withAuth = (req: Test) => req.set('Authorization', `Bearer ${token}`);

  return { agent, token, email, password, withAuth };
}

export async function onboardTenant(
  auth: E2eAuthContext,
  name?: string,
  options?: E2eRequestOptions,
): Promise<E2eTenantContext> {
  const headers = options?.useCsrf ? await csrfHeaders(auth.agent) : {};
  const onboarding = await auth
    .withAuth(auth.agent.post('/api/v1/onboarding/complete'))
    .set(headers)
    .send({
      name: name ?? `E2E ${Date.now()}`,
      industry: 'Technology',
      companySize: '1-10',
      businessCountry: 'NG',
    })
    .expect(201);

  const tenantId = onboarding.body.tenant.id as string;

  const tenants = await auth
    .withAuth(auth.agent.get('/api/v1/tenants/user/me?limit=10'))
    .expect(200);

  const ownerMemberId = tenants.body.records[0].member.id as string;

  return { ...auth, tenantId, ownerMemberId };
}

export async function inviteMember(
  owner: E2eTenantContext,
  email: string,
): Promise<{ token: string; email: string }> {
  const invite = await owner
    .withAuth(owner.agent.post(`/api/v1/tenants/${owner.tenantId}/invites`))
    .send({
      email,
      firstName: 'E2E',
      lastName: 'Employee',
      role: 'member',
    })
    .expect(201);

  return { token: invite.body.token as string, email };
}

export async function acceptInvitation(
  app: INestApplication,
  params: {
    token: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<void> {
  await request(app.getHttpServer())
    .post('/api/v1/invitations/accept')
    .send({
      token: params.token,
      email: params.email,
      password: params.password,
      firstName: params.firstName ?? 'E2E',
      lastName: params.lastName ?? 'Employee',
    })
    .expect(201);
}

/** Next Monday as YYYY-MM-DD (avoids weekend/holiday edge cases in leave calc). */
export function nextWeekdayDate(daysAhead = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export function signNombaWebhook(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function buildNombaTransferWebhook(params: {
  merchantTxRef: string;
  status?: string;
  reference?: string;
}): string {
  return JSON.stringify({
    event_type: 'transfer.success',
    data: {
      id: params.reference ?? 'txn-e2e',
      status: params.status ?? 'SUCCESS',
      meta: { merchantTxRef: params.merchantTxRef },
    },
  });
}
