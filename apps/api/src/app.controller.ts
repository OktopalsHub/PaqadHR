import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AppService } from './app.service';
import { Public } from './common/decorators';

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

  @Get('metrics')
  getMetrics() {
    return '# TYPE paqad_up gauge\npaqad_up 1\n';
  }

  @Get('csrf/token')
  getCsrfToken() {
    return { csrfToken: '' };
  }
}
