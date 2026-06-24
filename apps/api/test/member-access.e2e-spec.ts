import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request, { type Test } from 'supertest';
import { PayrollFrequency } from '../src/common/enums/payroll-frequency.enum';
import { PayrollItemStatus } from '../src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../src/common/enums/payroll-status.enum';
import { EAttendanceExceptionType } from '../src/common/enums';
import { PayrollItem } from '../src/modules/v1/payroll/entities/payroll-item.entity';
import { PayrollRun } from '../src/modules/v1/payroll/entities/payroll-run.entity';
import { createE2eApp, uniqueEmail } from './e2e-bootstrap';
import {
  acceptInvitation,
  inviteMember,
  onboardTenant,
  registerUser,
  seedMemberDocument,
  seedMemberPaymentMethod,
  seedPendingLeaveForMember,
  seedReportingLine,
  waitForTenantSettings,
  type E2eAuthContext,
} from './e2e-helpers';

async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<E2eAuthContext> {
  const agent = request.agent(app.getHttpServer());
  const loginRes = await agent
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(201);

  const token = loginRes.body.accessToken as string;
  const withAuth = (req: Test) => req.set('Authorization', `Bearer ${token}`);

  return { agent, token, email, password, withAuth };
}

async function seedPublishedPayrollItem(
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
      title: 'E2E manager payroll',
      frequency: PayrollFrequency.MONTHLY,
      periodStart: new Date('2026-02-01'),
      periodEnd: new Date('2026-02-28'),
      paymentDate: new Date('2026-03-01'),
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
      paidAt: new Date('2026-03-01'),
      metadata: { payslipPublished: true, payslipPublishedAt: new Date().toISOString() },
    }),
  );

  return { run, item };
}

describe('Member access (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('prevents employees from patching another member or creating education for them', async () => {
    const owner = await onboardTenant(await registerUser(app, 'access-owner'));
    await waitForTenantSettings(owner);
    const employeeEmail = uniqueEmail('access-employee');
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

    const ownerMember = members.body.find((m: { id: string }) => m.id === owner.ownerMemberId);
    const employeeMember = members.body.find(
      (m: { user?: { email?: string } }) =>
        m.user?.email?.toLowerCase() === employeeEmail.toLowerCase(),
    );
    expect(ownerMember).toBeDefined();
    expect(employeeMember).toBeDefined();

    const ownerDoc = await seedMemberDocument(app, owner.tenantId, ownerMember.id);
    const ownerPaymentMethod = await seedMemberPaymentMethod(
      app,
      owner.tenantId,
      ownerMember.id,
    );
    const { leaveId: ownerLeaveId } = await seedPendingLeaveForMember(owner, owner);

    await employee
      .withAuth(
        employee.agent.patch(
          `/api/v1/tenants/${owner.tenantId}/members/${ownerMember.id}`,
        ),
      )
      .send({ phone: '0000000000' })
      .expect(403);

    await employee
      .withAuth(
        employee.agent.post(`/api/v1/tenants/${owner.tenantId}/education`),
      )
      .send({
        memberId: ownerMember.id,
        title: 'Unauthorized degree',
        degreeType: 'bachelor',
        institution: 'Test University',
      })
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/education?memberId=${ownerMember.id}`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/members/${ownerMember.id}/employments`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}/employments`,
        ),
      )
      .expect(200);

    await employee
      .withAuth(
        employee.agent.get(`/api/v1/tenants/${owner.tenantId}/members/${ownerMember.id}`),
      )
      .expect(403);

    await owner
      .withAuth(
        owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}`),
      )
      .expect(200);

    await employee
      .withAuth(employee.agent.get(`/api/v1/tenants/${owner.tenantId}/leaves`))
      .expect(403);

    await employee
      .withAuth(employee.agent.get(`/api/v1/tenants/${owner.tenantId}/leaves/me?limit=10`))
      .expect(200);

    await employee
      .withAuth(
        employee.agent.patch(
          `/api/v1/tenants/${owner.tenantId}/leaves/${ownerLeaveId}/approve`,
        ),
      )
      .send({ comments: 'Nope' })
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(`/api/v1/tenants/${owner.tenantId}/leave-balances`),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/attendance/reports/daily?date=2026-06-01`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/attendance?employeeId=${ownerMember.id}`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payment-methods/member/${ownerMember.id}`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payment-methods/${ownerPaymentMethod.id}`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/documents?memberId=${ownerMember.id}`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(`/api/v1/tenants/${owner.tenantId}/documents/${ownerDoc.id}`),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.post(`/api/v1/tenants/${owner.tenantId}/documents/${ownerDoc.id}/restore`),
      )
      .expect(403);
  });

  it('allows managers to access direct reports and approve workflows', async () => {
    const owner = await onboardTenant(await registerUser(app, 'access-manager-owner'));
    await waitForTenantSettings(owner);

    const managerEmail = uniqueEmail('access-manager');
    const employeeEmail = uniqueEmail('access-report');
    const password = 'password123';

    const managerInvite = await inviteMember(owner, managerEmail);
    await acceptInvitation(app, {
      token: managerInvite.token,
      email: managerEmail,
      password,
      firstName: 'Team',
      lastName: 'Manager',
    });

    const employeeInvite = await inviteMember(owner, employeeEmail);
    await acceptInvitation(app, {
      token: employeeInvite.token,
      email: employeeEmail,
      password,
      firstName: 'Direct',
      lastName: 'Report',
    });

    const manager = await loginUser(app, managerEmail, password);
    const employee = await loginUser(app, employeeEmail, password);

    const members = await owner
      .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members`))
      .expect(200);

    const managerMember = members.body.find(
      (m: { user?: { email?: string } }) =>
        m.user?.email?.toLowerCase() === managerEmail.toLowerCase(),
    );
    const employeeMember = members.body.find(
      (m: { user?: { email?: string } }) =>
        m.user?.email?.toLowerCase() === employeeEmail.toLowerCase(),
    );
    expect(managerMember).toBeDefined();
    expect(employeeMember).toBeDefined();

    await seedReportingLine(owner, managerMember.id, employeeMember.id);

    const employeeDoc = await seedMemberDocument(app, owner.tenantId, employeeMember.id);
    await seedMemberPaymentMethod(app, owner.tenantId, employeeMember.id);
    const { leaveId } = await seedPendingLeaveForMember(owner, employee);
    await seedPublishedPayrollItem(app, owner.tenantId, employeeMember.id, owner.ownerMemberId);

    const exception = await employee
      .withAuth(
        employee.agent.post(`/api/v1/tenants/${owner.tenantId}/attendance/exceptions`),
      )
      .send({
        date: '2026-06-02',
        type: EAttendanceExceptionType.LATE,
        reason: 'Traffic',
      })
      .expect(201);

    await manager
      .withAuth(
        manager.agent.get(`/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}`),
      )
      .expect(200);

    await manager
      .withAuth(
        manager.agent.get(
          `/api/v1/tenants/${owner.tenantId}/attendance?employeeId=${employeeMember.id}`,
        ),
      )
      .expect(200);

    await manager
      .withAuth(
        manager.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payment-methods/member/${employeeMember.id}`,
        ),
      )
      .expect(200);

    await manager
      .withAuth(
        manager.agent.patch(
          `/api/v1/tenants/${owner.tenantId}/leaves/${leaveId}/approve`,
        ),
      )
      .send({ comments: 'Approved by manager' })
      .expect(200);

    await manager
      .withAuth(
        manager.agent.patch(
          `/api/v1/tenants/${owner.tenantId}/attendance/exceptions/${exception.body.id}/approve`,
        ),
      )
      .send({ comments: 'OK' })
      .expect(200);

    await manager
      .withAuth(
        manager.agent.get(
          `/api/v1/tenants/${owner.tenantId}/payroll/members/${employeeMember.id}/published-payslips`,
        ),
      )
      .expect(200);

    await manager
      .withAuth(
        manager.agent.get(`/api/v1/tenants/${owner.tenantId}/members/${owner.ownerMemberId}`),
      )
      .expect(403);

    await manager
      .withAuth(
        manager.agent.get(
          `/api/v1/tenants/${owner.tenantId}/documents?memberId=${owner.ownerMemberId}`,
        ),
      )
      .expect(403);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/attendance/exceptions/${exception.body.id}`,
        ),
      )
      .expect(200);

    await employee
      .withAuth(
        employee.agent.patch(
          `/api/v1/tenants/${owner.tenantId}/attendance/exceptions/${exception.body.id}/approve`,
        ),
      )
      .send({ comments: 'Self approve' })
      .expect(403);

    await manager
      .withAuth(
        manager.agent.get(`/api/v1/tenants/${owner.tenantId}/documents/${employeeDoc.id}`),
      )
      .expect(200);
  });
});
