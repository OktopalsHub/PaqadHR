import { Module } from '@nestjs/common';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { PaymentProviderFactoryService } from '../services/payment-provider-factory.service';
import { NombaProvider } from './nomba.provider';

@Module({
  providers: [NombaTransferApiService, NombaProvider, PaymentProviderFactoryService],
  exports: [NombaTransferApiService, NombaProvider, PaymentProviderFactoryService],
})
export class PaymentsModule {}
