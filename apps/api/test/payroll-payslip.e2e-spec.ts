import type { INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';
import { DataSource } from 'typeorm';
import { PayrollFrequency } from '../src/common/enums/payroll-frequency.enum';
import { PayrollItemStatus } from '../src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../src/common/enums/payroll-status.enum';
import { PayrollItem } from '../src/modules/v1/payroll/entities/payroll-item.entity';
import { PayrollRun } from '../src/modules/v1/payroll/entities/payroll-run.entity';
import { createE2eApp, uniqueEmail } from './e2e-bootstrap';
import {
  acceptInvitation,
  type E2eAuthContext,
  inviteMember,
  onboardTenant,
  registerUser,
} from './e2e-helpers';

async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<E2eAuthContext> {
  const agent = request.agent(app.getHttpServer());
  const loginRes = await agent.post('/api/v1/auth/login').send({ email, password }).expect(201);

  const token = loginRes.body.accessToken as string;
  const withAuth = (req: Test) => req.set('Authorization', `Bearer ${token}`);

  return { agent, token, email, password, withAuth };
}

async function seedPaidPayrollItem(
  app: INestApplication,
  tenantId: string,
  memberId: string,
  createdById: string,
) {
  const dataSource = app.get(DataSource);
  const runRepo = dataSource.getRepository(PayrollRun);
  const itemRepo = dataSource.getRepository(PayrollItem);

  const run = await runRepo.save(
    runRepo.create({
      title: 'E2E payslip payroll',
      frequency: PayrollFrequency.MONTHLY,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      paymentDate: new Date('2026-02-01'),
      status: PayrollStatus.COMPLETED,
      baseCurrency: 'NGN',
      totalGrossAmount: 100000,
      totalDeductions: 0,
      totalNetAmount: 100000,
      employeeCount: 1,
      tenantId,
      createdById,
    }),
  );

  const item = await itemRepo.save(
    itemRepo.create({
      payrollRunId: run.id,
      memberId,
      status: PayrollItemStatus.PAID,
      baseSalary: 100000,
      baseSalaryCurrency: 'NGN',
      grossAmount: 100000,
      adjustments: 0,
      deductions: 0,
      netAmount: 100000,
      paymentCurrency: 'NGN',
      paymentAmount: 100000,
      exchangeRate: 1,
      paidAt: new Date('2026-02-01'),
      metadata: {},
    }),
  );

  return { run, item };
}

describe('Payroll payslips (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes payslips and lets employees download PDF on demand', async () => {
    const owner = await onboardTenant(await registerUser(app, 'payslip-owner'));
    const employeeEmail = uniqueEmail('payslip-employee');
    const employeePassword = 'password123';

    const invite = await inviteMember(owner, employeeEmail);
    await acceptInvitation(app, {
      token: invite.token,
      email: employeeEmail,
      password: employeePassword,
    });

    const employee = await loginUser(app, employeeEmail, employeePassword);

    const members = await owner
      .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members`))
      .expect(200);

    const employeeMember = members.body.find(
      (m: { user?: { email?: string } }) =>
        m.user?.email?.toLowerCase() === employeeEmail.toLowerCase(),
    );
    expect(employeeMember).toBeDefined();

    const { run, item } = await seedPaidPayrollItem(
      app,
      owner.tenantId,
      employeeMember.id,
      owner.ownerMemberId,
    );

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payroll/runs/${run.id}/items/${item.id}/payslip/download`,
        ),
      )
      .expect(403);

    await owner
      .withAuth(
        owner.agent.post(
          `/api/v1/tenants/${owner.tenantId}/payroll/runs/${run.id}/payslips/publish`,
        ),
      )
      .send({ itemIds: [item.id], sendEmail: false })
      .expect(201);

    const published = await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payroll/members/${employeeMember.id}/published-payslips`,
        ),
      )
      .expect(200);

    expect(published.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: item.id,
          runId: run.id,
          memberId: employeeMember.id,
        }),
      ]),
    );

    const download = await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payroll/runs/${run.id}/items/${item.id}/payslip/download`,
        ),
      )
      .expect(200);

    expect(download.headers['content-type']).toMatch(/application\/pdf/);
    expect(
      Buffer.isBuffer(download.body) ? download.body.length : download.text.length,
    ).toBeGreaterThan(0);
  });
});
