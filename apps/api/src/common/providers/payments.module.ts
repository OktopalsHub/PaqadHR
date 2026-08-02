import { Module } from '@nestjs/common';
import { BachsApiService } from '../services/bachs-api.service';
import { MonnifyApiService } from '../services/monnify-api.service';
import { NoahApiService } from '../services/noah-api.service';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { PaymentProviderFactoryService } from '../services/payment-provider-factory.service';
import { NoahProvider } from './noah.provider';
import { NombaProvider } from './nomba.provider';

@Module({
  providers: [
    NombaTransferApiService,
    NombaProvider,
    BachsApiService,
    MonnifyApiService,
    NoahApiService,
    NoahProvider,
    PaymentProviderFactoryService,
  ],
  exports: [
    NombaTransferApiService,
    NombaProvider,
    BachsApiService,
    MonnifyApiService,
    NoahApiService,
    NoahProvider,
    PaymentProviderFactoryService,
  ],
})
export class PaymentsModule {}
