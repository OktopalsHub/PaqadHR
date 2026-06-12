import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from 'src/common/providers/payments.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { PaymentMethodService } from './services/payment-method.service';
import { TenantsModule } from '../tenants/tenants.module';
import { PaymentMethod } from "./entities/payment-method.entity";
import { PaymentMethodPasscodeHistory } from "./entities/payment-method-passcode-history.entity";
import { PaymentMethodController } from "./controllers/payment-method.controller";
import { PaymentMethodRepository } from "./repositories/payment-method.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentMethod, PaymentMethodPasscodeHistory]),
    PaymentsModule,
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService, PaymentMethodRepository],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}
