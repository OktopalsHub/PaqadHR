import type { INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';
import { createE2eApp, uniqueEmail } from './e2e-bootstrap';
import {
  acceptInvitation,
  type E2eAuthContext,
  inviteMember,
  onboardTenant,
  registerUser,
  waitForTenantSettings,
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

describe('Compensation salary history (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('appends salary history, enforces access, and keeps payroll on latest salary', async () => {
    const owner = await onboardTenant(await registerUser(app, 'comp-owner'));
    await waitForTenantSettings(owner);

    const employeeEmail = uniqueEmail('comp-employee');
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

    const firstSalary = await owner
      .withAuth(
        owner.agent.post(
          `/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}/compensation`,
        ),
      )
      .send({
        effectiveDate: '2025-01-01',
        payRate: 100000,
        payType: 'salary',
        paySchedule: 'monthly',
      })
      .expect(201);

    expect(Number(firstSalary.body.payRate)).toBe(100000);
    expect(firstSalary.body.endDate).toBeFalsy();

    const secondSalary = await owner
      .withAuth(
        owner.agent.post(
          `/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}/compensation`,
        ),
      )
      .send({
        effectiveDate: '2026-01-01',
        payRate: 150000,
        payType: 'salary',
        paySchedule: 'monthly',
        comments: 'Annual raise',
      })
      .expect(201);

    expect(Number(secondSalary.body.payRate)).toBe(150000);
    expect(secondSalary.body.endDate).toBeFalsy();

    const history = await owner
      .withAuth(
        owner.agent.get(
          `/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}/employments`,
        ),
      )
      .expect(200);

    expect(history.body).toHaveLength(2);
    expect(history.body[0].id).toBe(secondSalary.body.id);
    expect(history.body[0].endDate).toBeFalsy();
    expect(Number(history.body[0].payRate)).toBe(150000);
    expect(history.body[1].id).toBe(firstSalary.body.id);
    expect(history.body[1].endDate).toBeTruthy();
    expect(Number(history.body[1].payRate)).toBe(100000);

    const ownHistory = await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}/employments`,
        ),
      )
      .expect(200);

    expect(ownHistory.body).toHaveLength(2);

    await employee
      .withAuth(
        employee.agent.post(
          `/api/v1/tenants/${owner.tenantId}/members/${employeeMember.id}/compensation`,
        ),
      )
      .send({
        effectiveDate: '2026-06-01',
        payRate: 200000,
      })
      .expect(403);

    const preview = await owner
      .withAuth(owner.agent.post(`/api/v1/tenants/${owner.tenantId}/payroll/preview-calculation`))
      .send({
        employees: [{ employeeId: employeeMember.id }],
      })
      .expect(201);

    const previewRow = preview.body.employees.find(
      (row: { employeeId: string }) => row.employeeId === employeeMember.id,
    );
    expect(previewRow).toBeDefined();
    expect(Number(previewRow.baseSalary)).toBe(150000);
  });

  it('tracks position history separately from salary and restricts assign to admins', async () => {
    const owner = await onboardTenant(await registerUser(app, 'position-owner'));
    await waitForTenantSettings(owner);

    const employeeEmail = uniqueEmail('position-employee');
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

    const engineerPosition = await owner
      .withAuth(owner.agent.post(`/api/v1/tenants/${owner.tenantId}/positions`))
      .send({ title: 'Engineer', department: 'Product' })
      .expect(201);

    const leadPosition = await owner
      .withAuth(owner.agent.post(`/api/v1/tenants/${owner.tenantId}/positions`))
      .send({ title: 'Engineering Lead', department: 'Product' })
      .expect(201);

    await owner
      .withAuth(
        owner.agent.post(
          `/api/v1/tenants/${owner.tenantId}/positions/member/${employeeMember.id}/assign`,
        ),
      )
      .send({
        positionId: engineerPosition.body.id,
        assignedAt: '2025-01-01',
      })
      .expect(200);

    await owner
      .withAuth(
        owner.agent.post(
          `/api/v1/tenants/${owner.tenantId}/positions/member/${employeeMember.id}/assign`,
        ),
      )
      .send({
        positionId: leadPosition.body.id,
        assignedAt: '2026-01-01',
      })
      .expect(200);

    const history = await owner
      .withAuth(
        owner.agent.get(
          `/api/v1/tenants/${owner.tenantId}/positions/member/${employeeMember.id}/history`,
        ),
      )
      .expect(200);

    expect(history.body).toHaveLength(2);
    expect(history.body[0].position.title).toBe('Engineering Lead');
    expect(history.body[0].isCurrent).toBe(true);
    expect(history.body[1].position.title).toBe('Engineer');
    expect(history.body[1].isCurrent).toBe(false);

    await employee
      .withAuth(
        employee.agent.get(
          `/api/v1/tenants/${owner.tenantId}/positions/member/${employeeMember.id}/history`,
        ),
      )
      .expect(200);

    await employee
      .withAuth(
        employee.agent.post(
          `/api/v1/tenants/${owner.tenantId}/positions/member/${employeeMember.id}/assign`,
        ),
      )
      .send({
        positionId: engineerPosition.body.id,
        assignedAt: '2026-06-01',
      })
      .expect(403);
  });
});
