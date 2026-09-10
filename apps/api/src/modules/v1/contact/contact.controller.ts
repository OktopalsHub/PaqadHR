import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from 'src/common/decorators';
import { RateLimitService } from 'src/common/services/rate-limit.service';
import { TurnstileService } from 'src/common/services/turnstile.service';
import { GeoLocationHelper } from 'src/common/utils/geo-location.util';
import { ContactService } from './contact.service';
import { SubmitContactDto } from './dto/submit-contact.dto';

@ApiTags('Contact')
@Public()
@Controller('contact')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly rateLimitService: RateLimitService,
    private readonly turnstileService: TurnstileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Public contact form requirements' })
  getConfig() {
    return { turnstileRequired: this.turnstileService.isEnabled() };
  }

  @Post()
  @ApiOperation({ summary: 'Submit the public marketing contact form' })
  async submit(
    @Body() dto: SubmitContactDto,
    @Req() req: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ip);

    const rate = await this.rateLimitService.checkRateLimit(`contact:${clientIp}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 5 }],
    });
    if (!rate.allowed) {
      const retryAfter = rate.retryAfter ?? 60;
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.turnstileService.isEnabled()) {
      const valid = await this.turnstileService.verify(dto.turnstileToken ?? '', clientIp);
      if (!valid) {
        throw new BadRequestException('Captcha verification failed');
      }
    }

    return this.contactService.submit(dto);
  }
}
