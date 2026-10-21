import { Controller, type INestApplication, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { RateLimit, RateLimitPresets } from 'src/common/decorators';
import request from 'supertest';
import { RateLimitService } from '../services/rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

@Controller('rate-limit-test')
class RateLimitTestController {
  @Post('sensitive')
  @RateLimit(RateLimitPresets.SENSITIVE)
  handleSensitive(): { ok: boolean } {
    return { ok: true };
  }
}

describe('RateLimitGuard (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RateLimitTestController],
      providers: [RateLimitService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new RateLimitGuard(new Reflector(), app.get(RateLimitService)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the route until the limit, then returns 429 with a Retry-After header', async () => {
    const maxRequests = RateLimitPresets.SENSITIVE.rules[0].maxRequests;

    for (let attempt = 0; attempt < maxRequests; attempt += 1) {
      const allowed = await request(app.getHttpServer()).post('/rate-limit-test/sensitive');
      expect(allowed.status).toBe(201);
    }

    const blocked = await request(app.getHttpServer()).post('/rate-limit-test/sensitive');

    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
