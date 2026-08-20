import { Injectable, Logger } from '@nestjs/common';

/**
 * Handles payroll notifications.
 */
@Injectable()
export class PayrollNotificationService {
  private readonly logger = new Logger(PayrollNotificationService.name);

  async sendPayrollNotification(tenantId: string, type: string, data: any) {
    // TODO: Extract from payroll.service.ts
  }
}
