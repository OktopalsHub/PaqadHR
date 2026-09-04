import { BadRequestException, Body, Controller, Ip, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
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

  @Post()
  @ApiOperation({ summary: 'Submit the public marketing contact form' })
  async submit(@Body() dto: SubmitContactDto, @Req() req: Request, @Ip() ip: string) {
    const clientIp = GeoLocationHelper.resolveClientIp(req.headers, req.socket?.remoteAddress, ip);

    const rate = await this.rateLimitService.checkRateLimit(`contact:${clientIp}`, {
      rules: [{ windowMs: 15 * 60 * 1000, maxRequests: 5 }],
    });
    if (!rate.allowed) {
      throw new BadRequestException('Too many requests. Please try again later.');
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
