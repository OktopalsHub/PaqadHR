import { Controller, Get, HttpStatus, Req, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AppService } from './app.service';
import { Public } from './common/decorators';

type CsrfRequest = {
  csrfToken?: () => string;
};

@ApiTags('App')
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealthCheck() {
    return this.appService.getLiveness();
  }

  @Get('health')
  async getDetailedHealth(@Res({ passthrough: true }) res: Response) {
    const health = await this.appService.getReadiness();
    if (health.status === 'unhealthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Get('csrf/token')
  getCsrfToken(@Req() req: CsrfRequest) {
    const token = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    return { csrfToken: token ?? '' };
  }
}
