import { BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { verifyBridgeWebhookSignature } from 'src/common/config/bridge-webhook.util';
import { BridgeApiService } from 'src/common/services/bridge-api.service';
import { In, Repository } from 'typeorm';

import { CustodyWallet } from '../../wallets/entities/custody-wallet.entity';
import { ProviderCustomer } from '../../wallets/entities/provider-customer.entity';
import { ProviderWebhookEvent } from '../../wallets/entities/provider-webhook-event.entity';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { BridgeApplyOps } from './bridge-apply.ops';
import { BridgeHelperOps } from './bridge-helper.ops';

export class BridgeReconcileOps {
  private readonly logger = new Logger('BridgePayrollPayoutService');

  constructor(
    private readonly bridgeApi: BridgeApiService,
    @InjectRepository(CustodyWallet) private readonly wallets: Repository<CustodyWallet>,
    @InjectRepository(ProviderCustomer)
    private readonly customers: Repository<ProviderCustomer>,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    @InjectRepository(ProviderWebhookEvent)
    private readonly webhookEvents: Repository<ProviderWebhookEvent>,
    private readonly apply: BridgeApplyOps,
    private readonly helper: BridgeHelperOps,
  ) {}

  async reconcilePendingTransfers(): Promise<{ checked: number; failed: number }> {
    const operations = await this.operations.find({
      where: {
        provider: 'bridge',
        kind: In(['transfer', 'withdrawal']),
        status: In(['created', 'processing', 'requires_review']),
      },
      select: {
        id: true,
        tenantId: true,
        payrollRunId: true,
        payrollItemId: true,
        sourceWalletId: true,
        destinationWalletId: true,
        sourceAmount: true,
        sourceCurrency: true,
        destinationCurrency: true,
        providerReference: true,
        idempotencyKey: true,
        metadata: true,
      },
      order: { updatedAt: 'ASC' },
      take: 100,
    });
    let failed = 0;
    for (const operation of operations) {
      try {
        let transfer: Awaited<ReturnType<BridgeApiService['getTransfer']>>;
        if (operation.providerReference) {
          transfer = await this.bridgeApi.getTransfer(operation.providerReference);
        } else {
          transfer = await this.replayAmbiguousTransfer(operation);
        }
        const transferId = transfer.id;
        await this.operations
          .createQueryBuilder()
          .update(WalletOperation)
          .set({
            providerReference: transferId,
            status: 'processing',
          })
          .where('id = :id AND status IN (:...statuses)', {
            id: operation.id,
            statuses: ['created', 'processing', 'requires_review'],
          })
          .execute();
        await this.apply.applyTransferState(
          transferId,
          this.helper.readProviderState(transfer.state),
          null,
          operation.idempotencyKey,
          this.helper.readProviderReceipt(transfer.receipt),
        );
      } catch (error) {
        failed++;
        this.logger.warn(
          `Bridge payroll reconciliation failed for operation ${operation.id}: ${error instanceof Error ? error.name : 'unknown error'}`,
        );
      }
    }
    const unstartedBankTransfers = await this.operations
      .createQueryBuilder('operation')
      .where('operation.provider = :provider', { provider: 'bridge' })
      .andWhere('operation.kind = :kind', { kind: 'transfer' })
      .andWhere('operation.status = :status', { status: 'completed' })
      .andWhere("operation.metadata->>'payoutMode' = 'bank'")
      .orderBy('operation.updatedAt', 'ASC')
      .take(100)
      .getMany();
    for (const operation of unstartedBankTransfers) {
      try {
        await this.apply.startBankWithdrawal(operation);
      } catch (error) {
        failed++;
        this.logger.warn(
          `Bridge bank payout recovery failed for payroll operation ${operation.id}: ${error instanceof Error ? error.name : 'unknown error'}`,
        );
      }
    }
    return { checked: operations.length + unstartedBankTransfers.length, failed };
  }

  private async replayAmbiguousTransfer(
    operation: WalletOperation,
  ): Promise<Awaited<ReturnType<BridgeApiService['getTransfer']>>> {
    if (operation.kind === 'withdrawal') {
      if (!operation.sourceWalletId) {
        throw new BadRequestException('Bridge employee withdrawal has no source wallet.');
      }
      const employeeUserId = operation.metadata?.employeeUserId;
      const employeeCustomerId = operation.metadata?.employeeBridgeCustomerId;
      const externalAccountId = operation.metadata?.providerExternalAccountId;
      const bridgeCurrency = operation.metadata?.bridgeCurrency;
      const bridgePaymentRail = operation.metadata?.bridgePaymentRail;
      if (
        typeof employeeUserId !== 'string' ||
        typeof employeeCustomerId !== 'string' ||
        typeof externalAccountId !== 'string' ||
        typeof bridgeCurrency !== 'string' ||
        typeof bridgePaymentRail !== 'string' ||
        !operation.destinationAmount ||
        !operation.destinationCurrency
      ) {
        throw new BadRequestException('Bridge withdrawal cannot be safely replayed.');
      }
      const sourceWallet = await this.wallets.findOne({
        where: {
          id: operation.sourceWalletId,
          provider: 'bridge',
          ownerType: 'employee',
          userId: employeeUserId,
        },
        select: { id: true, providerWalletId: true },
      });
      if (!sourceWallet) {
        throw new BadRequestException('Bridge employee source wallet ownership changed.');
      }
      return this.bridgeApi.createTransfer(
        {
          on_behalf_of: employeeCustomerId,
          client_reference_id: operation.idempotencyKey,
          source: {
            payment_rail: 'bridge_wallet',
            currency: bridgeCurrency,
            bridge_wallet_id: sourceWallet.providerWalletId,
            amount: operation.sourceAmount,
          },
          destination: {
            payment_rail: bridgePaymentRail,
            currency: operation.destinationCurrency.toLowerCase(),
            external_account_id: externalAccountId,
            amount: operation.destinationAmount,
          },
        },
        operation.idempotencyKey,
      );
    }
    if (!operation.sourceWalletId || !operation.destinationWalletId) {
      throw new BadRequestException('Bridge payroll operation has incomplete wallet references.');
    }
    const [sourceWallet, destinationWallet] = await Promise.all([
      this.wallets.findOne({
        where: {
          id: operation.sourceWalletId,
          provider: 'bridge',
          ownerType: 'organization',
          tenantId: operation.tenantId,
        },
        select: { id: true, providerCustomerId: true, providerWalletId: true },
      }),
      this.wallets.findOne({
        where: { id: operation.destinationWalletId, provider: 'bridge', ownerType: 'employee' },
        select: { id: true, providerWalletId: true },
      }),
    ]);
    const bridgeCurrency = operation.metadata?.bridgeCurrency;
    const bridgePaymentRail = operation.metadata?.bridgePaymentRail;
    if (
      !sourceWallet ||
      !destinationWallet ||
      typeof bridgeCurrency !== 'string' ||
      typeof bridgePaymentRail !== 'string'
    ) {
      throw new BadRequestException('Bridge payroll operation cannot be safely replayed.');
    }
    const customer = await this.customers.findOne({
      where: { id: sourceWallet.providerCustomerId, provider: 'bridge' },
      select: { providerCustomerId: true },
    });
    if (!customer?.providerCustomerId) {
      throw new BadRequestException('Bridge organization customer reference is missing.');
    }
    return this.bridgeApi.createTransfer(
      {
        amount: operation.sourceAmount,
        on_behalf_of: customer.providerCustomerId,
        ...(typeof operation.metadata?.planFeeAmount === 'string' &&
        operation.metadata.planFeeAmount !== '0'
          ? { developer_fee: operation.metadata.planFeeAmount }
          : {}),
        client_reference_id: operation.idempotencyKey,
        source: {
          payment_rail: 'bridge_wallet',
          currency: bridgeCurrency,
          bridge_wallet_id: sourceWallet.providerWalletId,
        },
        destination: {
          payment_rail: bridgePaymentRail,
          currency: bridgeCurrency,
          bridge_wallet_id: destinationWallet.providerWalletId,
        },
      },
      operation.idempotencyKey,
    );
  }

  async dispatchTransferWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!verifyBridgeWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid Bridge webhook signature.');
    }
    const event = this.helper.parseEvent(rawBody);
    if (event.event_category !== 'transfer') return { received: true };
    if (!(await this.helper.claimEvent(event))) return { received: true };
    try {
      const transferId = event.event_object_id ?? event.event_object.id;
      if (typeof transferId !== 'string' || !transferId) {
        throw new BadRequestException('Bridge transfer event is missing its resource ID.');
      }
      const transfer = await this.bridgeApi.getTransfer(transferId);
      const clientReferenceId = event.event_object.client_reference_id;
      await this.apply.applyTransferState(
        transferId,
        this.helper.readProviderState(transfer.state),
        event.event_id,
        typeof clientReferenceId === 'string' ? clientReferenceId : null,
        this.helper.readProviderReceipt(transfer.receipt),
      );
      await this.webhookEvents.update(
        { provider: 'bridge', eventId: event.event_id },
        { processedAt: new Date() },
      );
      return { received: true };
    } catch (error) {
      await this.webhookEvents
        .createQueryBuilder()
        .update(ProviderWebhookEvent)
        .set({ receivedAt: new Date(Date.now() - 6 * 60 * 1000) })
        .where('provider = :provider AND event_id = :eventId AND processed_at IS NULL', {
          provider: 'bridge',
          eventId: event.event_id,
        })
        .execute();
      this.logger.warn(
        `Bridge transfer event ${event.event_id} failed: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
      throw error;
    }
  }
}
