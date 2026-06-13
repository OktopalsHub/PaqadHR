import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp, uniqueEmail } from './e2e-bootstrap';
import {
  acceptInvitation,
  inviteMember,
  nextWeekdayDate,
  onboardTenant,
  registerUser,
} from './e2e-helpers';

describe('HR flows (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('invites an employee, submits leave, and sends a shoutout', async () => {
    const owner = await onboardTenant(await registerUser(app, 'owner'));
    const employeeEmail = uniqueEmail('employee');
    const employeePassword = 'password123';

    const membersBefore = await owner
      .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members`))
      .expect(200);
    expect(membersBefore.body.length).toBe(1);

    const invite = await inviteMember(owner, employeeEmail);
    await acceptInvitation(app, {
      token: invite.token,
      email: employeeEmail,
      password: employeePassword,
    });

    const membersAfter = await owner
      .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/members`))
      .expect(200);
    expect(membersAfter.body.length).toBe(2);

    const employeeMember = membersAfter.body.find(
      (m: { user?: { email?: string } }) =>
        m.user?.email?.toLowerCase() === employeeEmail.toLowerCase(),
    );
    expect(employeeMember).toBeDefined();

    const leaveTypes = await owner
      .withAuth(
        owner.agent.get(`/api/v1/tenants/${owner.tenantId}/leave-types`),
      )
      .expect(200);
    expect(leaveTypes.body.length).toBeGreaterThan(0);

    const ptoType = leaveTypes.body.find(
      (lt: { name: string }) => lt.name === 'PTO',
    );
    expect(ptoType).toBeDefined();

    const leaveDay = nextWeekdayDate();
    const leave = await owner
      .withAuth(owner.agent.post(`/api/v1/tenants/${owner.tenantId}/leaves`))
      .send({
        leaveTypeId: ptoType.id,
        startDate: leaveDay,
        endDate: leaveDay,
        reason: 'E2E personal day',
      })
      .expect(201);

    expect(leave.body).toHaveProperty('id');
    expect(leave.body.status).toBe('pending');

    const leaves = await owner
      .withAuth(owner.agent.get(`/api/v1/tenants/${owner.tenantId}/leaves`))
      .expect(200);
    expect(leaves.body.records?.length).toBeGreaterThan(0);

    const category = await owner
      .withAuth(
        owner.agent.post(
          `/api/v1/tenants/${owner.tenantId}/shoutout-categories`,
        ),
      )
      .send({ name: 'Teamwork', description: 'Great collaboration' })
      .expect(201);

    const shoutout = await owner
      .withAuth(
        owner.agent.post(`/api/v1/tenants/${owner.tenantId}/shoutouts`),
      )
      .send({
        recipientIds: [employeeMember.id],
        pointsPerRecipient: 10,
        message: 'Thanks for jumping in during onboarding testing!',
        categoryIds: [category.body.id],
      })
      .expect(201);

    expect(shoutout.body.totalPoints).toBe(10);
    expect(shoutout.body.message).toContain('onboarding testing');

    const feed = await owner
      .withAuth(
        owner.agent.get(`/api/v1/tenants/${owner.tenantId}/shoutouts?limit=10`),
      )
      .expect(200);
    expect(feed.body.records?.length).toBeGreaterThan(0);
  });
});
