import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { PayrollFrequency } from '../src/common/enums/payroll-frequency.enum';
import { PayrollItemStatus } from '../src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../src/common/enums/payroll-status.enum';
import { PayrollItem } from '../src/modules/v1/payroll/entities/payroll-item.entity';
import { PayrollRun } from '../src/modules/v1/payroll/entities/payroll-run.entity';
import { createE2eApp } from './e2e-bootstrap';
import {
  buildNombaTransferWebhook,
  onboardTenant,
  registerUser,
  signNombaWebhook,
} from './e2e-helpers';

describe('Payroll webhooks (e2e)', () => {
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

  async function seedProcessingPayrollItem(tenantId: string, memberId: string) {
    const dataSource = app.get(DataSource);
    const runRepo = dataSource.getRepository(PayrollRun);
    const itemRepo = dataSource.getRepository(PayrollItem);

    const run = await runRepo.save(
      runRepo.create({
        title: 'E2E webhook payroll',
        frequency: PayrollFrequency.MONTHLY,
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        paymentDate: new Date('2026-02-01'),
        status: PayrollStatus.APPROVED,
        baseCurrency: 'NGN',
        totalGrossAmount: 100000,
        totalDeductions: 0,
        totalNetAmount: 100000,
        employeeCount: 1,
        tenantId,
        createdById: memberId,
      }),
    );

    const item = await itemRepo.save(
      itemRepo.create({
        payrollRunId: run.id,
        memberId,
        status: PayrollItemStatus.PROCESSING,
        baseSalary: 100000,
        baseSalaryCurrency: 'NGN',
        grossAmount: 100000,
        adjustments: 0,
        deductions: 0,
        netAmount: 100000,
        paymentCurrency: 'NGN',
        paymentAmount: 100000,
        exchangeRate: 1,
        transactionId: 'txn-e2e-pending',
      }),
    );

    return { run, item };
  }

  it('rejects webhooks without raw body middleware', async () => {
    const bareApp = await createE2eApp();
    try {
      await request(bareApp.getHttpServer())
        .post('/api/v1/payroll/webhooks/nomba')
        .send({ event_type: 'transfer.success' })
        .expect(401);
    } finally {
      await bareApp.close();
    }
  });

  it('accepts a signed Nomba webhook and marks payroll item paid', async () => {
    const auth = await registerUser(app, 'payroll-webhook', 'password123', { useCsrf: true });
    const tenant = await onboardTenant(auth, undefined, { useCsrf: true });
    const { run, item } = await seedProcessingPayrollItem(tenant.tenantId, tenant.ownerMemberId);

    const merchantRef = `payroll_${run.id}_${item.id}`;
    const rawBody = buildNombaTransferWebhook({
      merchantTxRef: merchantRef,
      reference: 'txn-e2e-success',
      status: 'SUCCESS',
    });
    const signature = signNombaWebhook(rawBody, webhookSecret);

    await request(app.getHttpServer())
      .post('/api/v1/payroll/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('x-nomba-signature', signature)
      .send(rawBody)
      .expect(200)
      .expect({ received: true });

    const dataSource = app.get(DataSource);
    const updated = await dataSource.getRepository(PayrollItem).findOneBy({ id: item.id });
    expect(updated?.status).toBe(PayrollItemStatus.PAID);
    expect(updated?.transactionId).toBe('txn-e2e-success');
    expect(updated?.paymentProvider).toBe('Nomba');
    expect(updated?.paidAt).toBeTruthy();

    const runAfter = await dataSource.getRepository(PayrollRun).findOneBy({ id: run.id });
    expect(runAfter?.status).toBe(PayrollStatus.COMPLETED);
  });

  it('marks payroll item failed on failed transfer webhook', async () => {
    const auth = await registerUser(app, 'payroll-webhook-fail', 'password123', {
      useCsrf: true,
    });
    const tenant = await onboardTenant(auth, undefined, { useCsrf: true });
    const { run, item } = await seedProcessingPayrollItem(tenant.tenantId, tenant.ownerMemberId);

    const merchantRef = `payroll_${run.id}_${item.id}`;
    const rawBody = buildNombaTransferWebhook({
      merchantTxRef: merchantRef,
      reference: 'txn-e2e-failed',
      status: 'FAILED',
    });
    const signature = signNombaWebhook(rawBody, webhookSecret);

    await request(app.getHttpServer())
      .post('/api/v1/payroll/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('x-nomba-signature', signature)
      .send(rawBody)
      .expect(200);

    const dataSource = app.get(DataSource);
    const failed = await dataSource.getRepository(PayrollItem).findOneBy({ id: item.id });
    expect(failed?.status).toBe(PayrollItemStatus.FAILED);
    expect(failed?.failureReason).toContain('failed');

    const runAfter = await dataSource.getRepository(PayrollRun).findOneBy({ id: run.id });
    expect(runAfter?.status).toBe(PayrollStatus.FAILED);
  });

  it('rejects invalid signatures without changing payroll items', async () => {
    const auth = await registerUser(app, 'payroll-webhook-bad-sig', 'password123', {
      useCsrf: true,
    });
    const tenant = await onboardTenant(auth, undefined, { useCsrf: true });
    const { run, item } = await seedProcessingPayrollItem(tenant.tenantId, tenant.ownerMemberId);

    const merchantRef = `payroll_${run.id}_${item.id}`;
    const rawBody = buildNombaTransferWebhook({ merchantTxRef: merchantRef });

    await request(app.getHttpServer())
      .post('/api/v1/payroll/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('x-nomba-signature', 'invalid-signature')
      .send(rawBody)
      .expect(401);

    const dataSource = app.get(DataSource);
    const unchanged = await dataSource.getRepository(PayrollItem).findOneBy({ id: item.id });
    expect(unchanged?.status).toBe(PayrollItemStatus.PROCESSING);
  });

  it('does not require authentication', async () => {
    const rawBody = buildNombaTransferWebhook({
      merchantTxRef: 'payroll_00000000-0000-4000-8000-000000000001_00000000-0000-4000-8000-000000000002',
    });
    const signature = signNombaWebhook(rawBody, webhookSecret);

    await request(app.getHttpServer())
      .post('/api/v1/payroll/webhooks/nomba')
      .set('Content-Type', 'application/json')
      .set('X-Nomba-Signature', signature)
      .send(rawBody)
      .expect(200);
  });
});
