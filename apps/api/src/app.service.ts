import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

export interface HealthCheckResult {
  status: 'ok' | 'healthy' | 'unhealthy';
  message: string;
  timestamp: string;
  version: string;
  uptime?: number;
  memory?: NodeJS.MemoryUsage;
  checks?: {
    database: {
      status: 'connected' | 'disconnected';
      latencyMs: number | null;
    };
  };
}

@Injectable()
export class AppService {
  private readonly version = '1.0.0';

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  getLiveness(): HealthCheckResult {
    return {
      status: 'ok',
      message: 'PaqadHR Server is running!',
      timestamp: new Date().toISOString(),
      version: this.version,
    };
  }

  async getReadiness(): Promise<HealthCheckResult> {
    const database = await this.checkDatabase();
    const healthy = database.status === 'connected';

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy ? 'Server is operational' : 'Database check failed',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: this.version,
      checks: { database },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'connected' | 'disconnected';
    latencyMs: number | null;
  }> {
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        status: 'disconnected',
        latencyMs: null,
      };
    }
  }
}
