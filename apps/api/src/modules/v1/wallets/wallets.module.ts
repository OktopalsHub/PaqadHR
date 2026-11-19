import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BridgeModule } from '../../../common/providers/bridge.module';
import { PaymentMethodModule } from '../payment-method/payment-method.module';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { MyWalletsController } from './controllers/my-wallets.controller';
import { WalletsController } from './controllers/wallets.controller';
import { CustodyWallet } from './entities/custody-wallet.entity';
import { ProviderCustomer } from './entities/provider-customer.entity';
import { ProviderExternalAccount } from './entities/provider-external-account.entity';
import { ProviderVirtualAccount } from './entities/provider-virtual-account.entity';
import { ProviderWebhookEvent } from './entities/provider-webhook-event.entity';
import { WalletFunding } from './entities/wallet-funding.entity';
import { WalletLedgerAccount } from './entities/wallet-ledger-account.entity';
import { WalletLedgerEntry } from './entities/wallet-ledger-entry.entity';
import { WalletLedgerTransaction } from './entities/wallet-ledger-transaction.entity';
import { WalletOperation } from './entities/wallet-operation.entity';
import { BridgeWalletWebhookService } from './services/bridge-wallet-webhook.service';
import { BridgeWalletService } from './services/bridge-wallet.service';
import { WalletLedgerService } from './services/wallet-ledger.service';

@Module({
  imports: [
    BridgeModule,
    TenantMembersModule,
    PaymentMethodModule,
    TypeOrmModule.forFeature([
      ProviderCustomer,
      ProviderExternalAccount,
      ProviderVirtualAccount,
      ProviderWebhookEvent,
      WalletFunding,
      CustodyWallet,
      WalletLedgerAccount,
      WalletLedgerTransaction,
      WalletLedgerEntry,
      WalletOperation,
      TenantMember,
      Tenant,
      User,
    ]),
  ],
  controllers: [WalletsController, MyWalletsController],
  providers: [BridgeWalletService, WalletLedgerService, BridgeWalletWebhookService],
  exports: [BridgeWalletService, WalletLedgerService, BridgeWalletWebhookService],
})
export class WalletsModule {}
