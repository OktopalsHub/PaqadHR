import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { TurnstileService } from 'src/common/services/turnstile.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

describe('ContactController', () => {
  let controller: ContactController;
  let contactService: { submit: jest.Mock };
  let rateLimitService: { checkRateLimit: jest.Mock };
  let turnstileService: { isEnabled: jest.Mock; verify: jest.Mock };

  const dto = {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Hello',
    turnstileToken: 'token',
  };

  const req = {
    headers: {},
    socket: { remoteAddress: '203.0.113.10' },
  } as unknown as Request;

  const res = {
    setHeader: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    contactService = { submit: jest.fn().mockResolvedValue({ success: true }) };
    rateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
    };
    turnstileService = {
      isEnabled: jest.fn().mockReturnValue(true),
      verify: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        { provide: ContactService, useValue: contactService },
        { provide: RateLimitService, useValue: rateLimitService },
        { provide: TurnstileService, useValue: turnstileService },
      ],
    }).compile();

    controller = module.get(ContactController);
    jest.clearAllMocks();
    contactService.submit.mockResolvedValue({ success: true });
    rateLimitService.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4 });
    turnstileService.isEnabled.mockReturnValue(true);
    turnstileService.verify.mockResolvedValue(true);
  });

  it('submits when rate limit and turnstile pass', async () => {
    await expect(controller.submit(dto, req, '203.0.113.10', res)).resolves.toEqual({
      success: true,
    });
    expect(contactService.submit).toHaveBeenCalledWith(dto);
  });

  it('returns 429 when rate limited', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfter: 42,
    });

    let caught: unknown;
    try {
      await controller.submit(dto, req, '203.0.113.10', res);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(contactService.submit).not.toHaveBeenCalled();
  });

  it('rejects when turnstile fails', async () => {
    turnstileService.verify.mockResolvedValue(false);
    await expect(controller.submit(dto, req, '203.0.113.10', res)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(contactService.submit).not.toHaveBeenCalled();
  });

  it('reports whether turnstile is required', () => {
    turnstileService.isEnabled.mockReturnValue(true);
    expect(controller.getConfig()).toEqual({ turnstileRequired: true });
    turnstileService.isEnabled.mockReturnValue(false);
    expect(controller.getConfig()).toEqual({ turnstileRequired: false });
  });
});
