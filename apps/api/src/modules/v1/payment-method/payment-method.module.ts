import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PaymentMethodController } from './controllers/payment-method.controller';
import { PaymentSecurityController } from './controllers/payment-security.controller';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentMethodPasscodeHistory } from './entities/payment-method-passcode-history.entity';
import { PaymentSecurity } from './entities/payment-security.entity';
import { PaymentMethodRepository } from './repositories/payment-method.repository';
import { PaymentSecurityRepository } from './repositories/payment-security.repository';
import { NigerianBankService } from './services/nigerian-bank.service';
import { PaymentMethodService } from './services/payment-method.service';
import { PaymentMethodVerificationService } from './services/payment-method-verification.service';
import { PaymentSecurityService } from './services/payment-security.service';
import { PayrollReadinessService } from './services/payroll-readiness.service';
import { PmCreationService } from './services/pm-creation.service';
import { PmPasscodeService } from './services/pm-passcode.service';
import { PmVerificationService } from './services/pm-verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentMethod,
      PaymentMethodPasscodeHistory,
      PaymentSecurity,
      TenantMember,
    ]),
    PaymentsModule,
    AuditLogsModule,
    AuthModule,
    TenantsModule,
    TenantMembersModule,
    TenantConfigModule,
    NotificationsModule,
  ],
  controllers: [PaymentMethodController, PaymentSecurityController],
  providers: [
    PaymentMethodService,
    PmCreationService,
    PmPasscodeService,
    PmVerificationService,
    PaymentMethodRepository,
    PaymentSecurityService,
    PaymentSecurityRepository,
    NigerianBankService,
    PayrollReadinessService,
    PaymentMethodVerificationService,
  ],
  exports: [
    PaymentMethodService,
    PaymentSecurityService,
    NigerianBankService,
    PayrollReadinessService,
    PaymentMethodVerificationService,
  ],
})
export class PaymentMethodModule {}
