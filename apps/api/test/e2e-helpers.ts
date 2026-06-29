import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';
import { DataSource } from 'typeorm';
import { IntegrationType, PaymentMethodType } from '../src/common/enums';
import { DocumentType } from '../src/common/enums/document-type.enum';
import { PaymentMethodStatus } from '../src/common/enums/payment-method-status.enum';
import { PlatformIntegrationService } from '../src/common/integrations/services/platform-integration.service';
import { Document as MemberDocument } from '../src/modules/v1/document/entities/document.entity';
import { PaymentMethod } from '../src/modules/v1/payment-method/entities/payment-method.entity';
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

/** Poll until async tenant.settings.initialize listener has finished. */
export async function waitForTenantSettings(
  owner: E2eTenantContext,
  maxAttempts = 30,
  delayMs = 100,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await owner.withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/settings`));
    if (res.status === 200) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Tenant settings not ready for tenant ${owner.tenantId}`);
}

/** Shoutouts via API require Slack + channel configured for the tenant. */
export async function seedShoutoutSlackIntegration(
  app: INestApplication,
  owner: E2eTenantContext,
): Promise<void> {
  const platformIntegrationService = app.get(PlatformIntegrationService);
  await platformIntegrationService.createIntegration(
    owner.tenantId,
    IntegrationType.SLACK,
    {
      teamId: 'T-E2E-TEST',
      teamName: 'E2E Test Workspace',
      accessToken: 'xoxp-e2e-test',
      botToken: 'xoxb-e2e-test',
    },
    owner.ownerMemberId,
  );
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

export async function seedReportingLine(
  owner: E2eTenantContext,
  managerMemberId: string,
  employeeMemberId: string,
): Promise<void> {
  const positionsRes = await owner
    .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/positions`))
    .expect(200);

  let positionId = positionsRes.body?.[0]?.id as string | undefined;
  if (!positionId) {
    const createdPosition = await owner
      .withAuth(owner.agent.post(`/api/v1/tenants/${owner.tenantId}/positions`))
      .send({ title: 'E2E Staff', description: 'E2E position' })
      .expect(201);
    positionId = createdPosition.body.id as string;
  }

  const createEmployment = async (memberId: string, reportsToId?: string) => {
    await owner
      .withAuth(
        owner.agent.post(`/api/v1/tenants/${owner.tenantId}/members/${memberId}/employments`),
      )
      .send({
        startDate: new Date().toISOString(),
        positionId,
        payRate: 100000,
        reportsToId,
      })
      .expect(201);
  };

  const managerEmployments = await owner
    .withAuth(
      owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members/${managerMemberId}/employments`),
    )
    .expect(200);

  if (!managerEmployments.body?.length) {
    await createEmployment(managerMemberId);
  }

  const employeeEmployments = await owner
    .withAuth(
      owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members/${employeeMemberId}/employments`),
    )
    .expect(200);

  if (!employeeEmployments.body?.length) {
    await createEmployment(employeeMemberId, managerMemberId);
    return;
  }

  const employmentId = employeeEmployments.body[0].id as string;
  await owner
    .withAuth(owner.agent.patch(`/api/v1/tenants/${owner.tenantId}/employments/${employmentId}`))
    .send({ reportsToId: managerMemberId })
    .expect(200);
}

export async function seedMemberDocument(
  app: INestApplication,
  tenantId: string,
  memberId: string,
): Promise<MemberDocument> {
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(MemberDocument);
  return repo.save(
    repo.create({
      tenantId,
      tenantMemberId: memberId,
      type: DocumentType.RESUME_CV,
      name: 'resume.pdf',
      fileKey: `e2e/documents/${memberId}/resume.pdf`,
      isVerified: true,
    }),
  );
}

export async function seedMemberPaymentMethod(
  app: INestApplication,
  tenantId: string,
  memberId: string,
): Promise<PaymentMethod> {
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(PaymentMethod);
  return repo.save(
    repo.create({
      tenantId,
      memberId,
      type: PaymentMethodType.BANK,
      currency: 'NGN',
      bankName: 'E2E Bank',
      accountName: 'E2E Account',
      accountNumber: '1234567890',
      status: PaymentMethodStatus.VERIFIED,
      isPrimary: true,
    }),
  );
}

export async function seedPendingLeaveForMember(
  owner: E2eTenantContext,
  memberAuth: E2eAuthContext,
): Promise<{ leaveId: string }> {
  const leaveTypes = await owner
    .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/leave-types`))
    .expect(200);
  const ptoType = leaveTypes.body.find((lt: { name: string }) => lt.name === 'PTO');
  if (!ptoType) {
    throw new Error('PTO leave type not found');
  }
  const leaveDay = nextWeekdayDate();
  const leave = await memberAuth
    .withAuth(memberAuth.agent.post(`/api/v1/tenants/${owner.tenantId}/leaves`))
    .send({
      leaveTypeId: ptoType.id,
      startDate: leaveDay,
      endDate: leaveDay,
      reason: 'E2E leave for access test',
    })
    .expect(201);
  return { leaveId: leave.body.id as string };
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

export function buildNombaPaymentWebhook(params: {
  tenantId: string;
  planId: string;
  planPriceId: string;
  reference: string;
  amount: number;
  currency?: string;
  quantity?: number;
  billingType?: string;
  tokenKey?: string;
  eventId?: string;
}): string {
  return JSON.stringify({
    event_type: 'payment_success',
    data: {
      orderReference: params.reference,
      amount: params.amount,
      currency: params.currency ?? 'NGN',
      status: 'success',
      tokenizedCardData: params.tokenKey ? { tokenKey: params.tokenKey } : undefined,
      transaction: { transactionId: params.eventId ?? params.reference },
      order: {
        orderReference: params.reference,
        amount: params.amount,
        currency: params.currency ?? 'NGN',
        orderMetaData: {
          tenantId: params.tenantId,
          planId: params.planId,
          planPriceId: params.planPriceId,
          quantity: String(params.quantity ?? 1),
          billingType: params.billingType ?? 'subscription',
        },
      },
    },
  });
}
