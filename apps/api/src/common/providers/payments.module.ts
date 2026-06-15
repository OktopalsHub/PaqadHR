import { Module } from '@nestjs/common';
import { PaymentProviderFactoryService } from '../services/payment-provider-factory.service';
import { NombaProvider } from './nomba.provider';

@Module({
  providers: [NombaProvider, PaymentProviderFactoryService],
  exports: [NombaProvider, PaymentProviderFactoryService],
})
export class PaymentsModule {}
