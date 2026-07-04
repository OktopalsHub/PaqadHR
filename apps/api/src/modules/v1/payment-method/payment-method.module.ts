import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PaymentMethodController } from './controllers/payment-method.controller';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentMethodPasscodeHistory } from './entities/payment-method-passcode-history.entity';
import { PaymentMethodRepository } from './repositories/payment-method.repository';
import { PaymentMethodService } from './services/payment-method.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentMethod, PaymentMethodPasscodeHistory]),
    PaymentsModule,
    AuditLogsModule,
    TenantsModule,
    TenantMembersModule,
    TenantConfigModule,
  ],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService, PaymentMethodRepository],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}
