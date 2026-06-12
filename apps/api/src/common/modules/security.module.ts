import { Module } from '@nestjs/common';
import { SecurityAuditService } from '../services/security-audit.service';

@Module({
  providers: [SecurityAuditService],
  exports: [SecurityAuditService],
})
export class SecurityModule {}
