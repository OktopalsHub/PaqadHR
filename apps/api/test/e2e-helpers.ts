import { INestApplication } from '@nestjs/common';
import request, { Test } from 'supertest';
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

export async function registerUser(
  app: INestApplication,
  prefix: string,
  password = 'password123',
): Promise<E2eAuthContext> {
  const agent = request.agent(app.getHttpServer());
  const email = uniqueEmail(prefix);
  const registerRes = await agent
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect(201);

  const token = registerRes.body.accessToken as string;
  const withAuth = (req: Test) => req.set('Authorization', `Bearer ${token}`);

  return { agent, token, email, password, withAuth };
}

export async function onboardTenant(
  auth: E2eAuthContext,
  name?: string,
): Promise<E2eTenantContext> {
  const onboarding = await auth
    .withAuth(auth.agent.post('/api/v1/onboarding/complete'))
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
