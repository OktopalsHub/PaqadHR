import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './e2e-bootstrap';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns liveness JSON', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.message).toContain('PaqadHR');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('GET /health returns readiness with database check', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(['healthy', 'unhealthy']).toContain(res.body.status);
        expect(res.body.checks?.database).toBeDefined();
      });
  });
});

describe('CSRF token (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp({ withRateLimit: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /csrf/token returns a CSRF token', () => {
    return request(app.getHttpServer())
      .get('/csrf/token')
      .expect(200)
      .expect((res) => {
        expect(typeof res.body.csrfToken).toBe('string');
        expect(res.body.csrfToken.length).toBeGreaterThan(0);
      });
  });

  it('rejects mutating requests without a CSRF token when using cookie sessions', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/csrf/token').expect(200);

    await agent
      .patch('/api/v1/profile')
      .send({ firstName: 'NoCsrf' })
      .expect(403)
      .expect((res) => {
        expect(res.body.message).toContain('CSRF');
      });
  });

  it('rate limits repeated auth login attempts', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `ratelimit-${Date.now()}@example.com`;
    const password = 'password123';

    for (let i = 0; i < 5; i++) {
      await agent.post('/api/v1/auth/login').send({ email, password });
    }

    await agent
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(429);
  });
});
