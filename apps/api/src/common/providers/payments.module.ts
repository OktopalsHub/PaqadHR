import { Module } from '@nestjs/common';
import { BachsApiService } from '../services/bachs-api.service';
import { FincraApiService } from '../services/fincra-api.service';
import { FincraAuthService } from '../services/fincra-auth.service';
import { FincraPayoutService } from '../services/fincra-payout.service';
import { FincraRequestsService } from '../services/fincra-requests.service';
import { MonnifyAirtimeService } from '../services/monnify-airtime.service';
import { MonnifyApiService } from '../services/monnify-api.service';
import { MonnifyAuthService } from '../services/monnify-auth.service';
import { MonnifyCheckoutService } from '../services/monnify-checkout.service';
import { MonnifyDisbursementService } from '../services/monnify-disbursement.service';
import { MonnifyValidationService } from '../services/monnify-validation.service';
import { NoahApiService } from '../services/noah-api.service';
import { NoahAuthService } from '../services/noah-auth.service';
import { NoahCheckoutService } from '../services/noah-checkout.service';
import { NoahPayoutService } from '../services/noah-payout.service';
import { NoahRequestsService } from '../services/noah-requests.service';
import { NombaAuthService } from '../services/nomba-auth.service';
import { NombaTransferApiService } from '../services/nomba-transfer-api.service';
import { NombaTransfersService } from '../services/nomba-transfers.service';
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
    NombaAuthService,
    NombaTransfersService,
    NombaProvider,
    MonnifyProvider,
    FincraApiService,
    FincraAuthService,
    FincraPayoutService,
    FincraRequestsService,
    FincraProvider,
    BachsApiService,
    MonnifyApiService,
    MonnifyAuthService,
    MonnifyCheckoutService,
    MonnifyDisbursementService,
    MonnifyValidationService,
    MonnifyAirtimeService,
    NoahApiService,
    NoahAuthService,
    NoahCheckoutService,
    NoahPayoutService,
    NoahRequestsService,
    NoahProvider,
    PaymentProviderFactoryService,
    ...checkoutAdapters,
    ...payoutQueriers,
  ],
  exports: [
    NombaTransferApiService,
    NombaAuthService,
    NombaTransfersService,
    NombaProvider,
    MonnifyProvider,
    FincraApiService,
    FincraAuthService,
    FincraPayoutService,
    FincraRequestsService,
    FincraProvider,
    BachsApiService,
    MonnifyApiService,
    MonnifyAuthService,
    MonnifyCheckoutService,
    MonnifyDisbursementService,
    MonnifyValidationService,
    MonnifyAirtimeService,
    NoahApiService,
    NoahAuthService,
    NoahCheckoutService,
    NoahPayoutService,
    NoahRequestsService,
    NoahProvider,
    PaymentProviderFactoryService,
    ...checkoutAdapters,
    ...payoutQueriers,
  ],
})
export class PaymentsModule {}
