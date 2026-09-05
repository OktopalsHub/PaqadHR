import { forwardRef, Module } from '@nestjs/common';
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
import { PaymentMethodService } from './services/payment-method.service';
import { PaymentSecurityService } from './services/payment-security.service';

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
    forwardRef(() => AuthModule),
    forwardRef(() => TenantsModule),
    forwardRef(() => TenantMembersModule),
    TenantConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PaymentMethodController, PaymentSecurityController],
  providers: [
    PaymentMethodService,
    PaymentMethodRepository,
    PaymentSecurityService,
    PaymentSecurityRepository,
  ],
  exports: [PaymentMethodService, PaymentSecurityService],
})
export class PaymentMethodModule {}
