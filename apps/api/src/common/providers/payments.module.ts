import { Module } from '@nestjs/common';
import { BachsApiService } from '../services/bachs-api.service';
import { FincraApiService } from '../services/fincra-api.service';
import { MonnifyApiService } from '../services/monnify-api.service';
import { NoahApiService } from '../services/noah-api.service';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { PaymentProviderFactoryService } from '../services/payment-provider-factory.service';
import { BachsCheckoutAdapter } from './checkout-providers/bachs-checkout.adapter';
import { FincraCheckoutAdapter } from './checkout-providers/fincra-checkout.adapter';
import { MonnifyCheckoutAdapter } from './checkout-providers/monnify-checkout.adapter';
import { NoahCheckoutAdapter } from './checkout-providers/noah-checkout.adapter';
import { NombaCheckoutAdapter } from './checkout-providers/nomba-checkout.adapter';
import { FincraProvider } from './fincra.provider';
import { MonnifyProvider } from './monnify.provider';
import { NoahProvider } from './noah.provider';
import { NombaProvider } from './nomba.provider';
import { FincraPayoutQuerierAdapter } from './payout-queriers/fincra-payout-querier.adapter';
import { MonnifyPayoutQuerierAdapter } from './payout-queriers/monnify-payout-querier.adapter';
import { NoahPayoutQuerierAdapter } from './payout-queriers/noah-payout-querier.adapter';
import { NombaPayoutQuerierAdapter } from './payout-queriers/nomba-payout-querier.adapter';

const checkoutAdapters = [
  NombaCheckoutAdapter,
  MonnifyCheckoutAdapter,
  NoahCheckoutAdapter,
  FincraCheckoutAdapter,
  BachsCheckoutAdapter,
];

const payoutQueriers = [
  NombaPayoutQuerierAdapter,
  MonnifyPayoutQuerierAdapter,
  NoahPayoutQuerierAdapter,
  FincraPayoutQuerierAdapter,
];

@Module({
  providers: [
    NombaTransferApiService,
    NombaProvider,
    MonnifyProvider,
    FincraApiService,
    FincraProvider,
    BachsApiService,
    MonnifyApiService,
    NoahApiService,
    NoahProvider,
    PaymentProviderFactoryService,
    ...checkoutAdapters,
    ...payoutQueriers,
  ],
  exports: [
    NombaTransferApiService,
    NombaProvider,
    MonnifyProvider,
    FincraApiService,
    FincraProvider,
    BachsApiService,
    MonnifyApiService,
    NoahApiService,
    NoahProvider,
    PaymentProviderFactoryService,
    ...checkoutAdapters,
    ...payoutQueriers,
  ],
})
export class PaymentsModule {}
