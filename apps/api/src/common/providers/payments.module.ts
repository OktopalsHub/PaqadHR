import { Module } from '@nestjs/common';
import { NombaProvider } from './nomba.provider';
import { PaymentProviderFactoryService } from '../services/payment-provider-factory.service';

@Module({
  providers: [NombaProvider, PaymentProviderFactoryService],
  exports: [NombaProvider, PaymentProviderFactoryService],
})
export class PaymentsModule {}
