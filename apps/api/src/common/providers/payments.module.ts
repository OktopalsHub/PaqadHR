import { Module } from '@nestjs/common';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { NombaVirtualAccountApiService } from '../services/nomba-virtual-account-api.service';
import { PaymentProviderFactoryService } from '../services/payment-provider-factory.service';
import { NombaProvider } from './nomba.provider';

@Module({
  providers: [
    NombaTransferApiService,
    NombaVirtualAccountApiService,
    NombaProvider,
    PaymentProviderFactoryService,
  ],
  exports: [
    NombaTransferApiService,
    NombaVirtualAccountApiService,
    NombaProvider,
    PaymentProviderFactoryService,
  ],
})
export class PaymentsModule {}
