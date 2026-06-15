import { Injectable } from '@nestjs/common';

@Injectable()
export class SecurityAuditService {
  async logSecurityEvent(_event: string, _metadata?: Record<string, unknown>): Promise<void> {}
}
