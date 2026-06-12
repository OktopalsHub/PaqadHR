import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';
@ApiTags('App')
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  @Get() getHealthCheck() {
    return {
      status: 'ok',
      message: 'PaqadHR Server is running!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
  @Get('health') getDetailedHealth() {
    return {
      status: 'healthy',
      message: 'Server is operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
    };
  }
}
