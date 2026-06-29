import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../../../common/modules/security.module';
import { NombaProvider } from '../../../common/providers/nomba.provider';
import { PaymentsModule as CommonPaymentsModule } from '../../../common/providers/payments.module';
import { PaymentProviderFactoryService } from '../../../common/services/payment-provider-factory.service';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { PaymentMethodPasscodeHistory } from '../payment-method/entities/payment-method-passcode-history.entity';
import { PaymentMethodModule } from '../payment-method/payment-method.module';
import { PaymentMethodService } from '../payment-method/services/payment-method.service';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { NombaUtilsController } from './controllers/nomba-utils.controller';
import { PaymentMethodsController } from './controllers/payment-methods.controller';
import { WebhooksController } from './controllers/webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentMethod, PaymentMethodPasscodeHistory]),
    TenantMembersModule,
    PaymentMethodModule,
    TenantsModule,
    SecurityModule,
    CommonPaymentsModule,
  ],
  controllers: [PaymentMethodsController, WebhooksController, NombaUtilsController],
  providers: [PaymentMethodService, PaymentProviderFactoryService, NombaProvider],
  exports: [PaymentMethodService, NombaProvider],
})
export class PaymentsModule {}
