import { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import type { BridgeRunContextOps } from './bridge-run-context.ops';
import type { BridgeTransferPrepOps } from './bridge-transfer-prep.ops';
import type { BridgeTransferSubmitOps } from './bridge-transfer-submit.ops';
import type { BridgeWithdrawalPrepOps } from './bridge-withdrawal-prep.ops';
import type { BridgeWithdrawalSubmitOps } from './bridge-withdrawal-submit.ops';

export type BridgeTransferEvent = {
  event_id: string;
  event_category: string;
  event_type: string;
  event_object_id?: string;
  event_object: Record<string, unknown>;
};

export const FAILED_TRANSFER_STATES = new Set([
  'error',
  'cancelled',
  'canceled',
  'undeliverable',
  'returned',
  'refunded',
]);
export const WALLET_SCALE = 12n;
export const WALLET_FACTOR = 10n ** WALLET_SCALE;

export type WithdrawalMeta = NonNullable<
  Awaited<ReturnType<BridgeWithdrawalPrepOps['readWithdrawalMetadata']>>
>;
export type WithdrawalContext = { parent: WalletOperation } & WithdrawalMeta &
  NonNullable<Awaited<ReturnType<BridgeWithdrawalPrepOps['selectWithdrawalAttempt']>>> &
  NonNullable<Awaited<ReturnType<BridgeWithdrawalPrepOps['loadWithdrawalParties']>>>;
export type WithdrawalReserved = NonNullable<
  Awaited<ReturnType<BridgeWithdrawalSubmitOps['reserveWithdrawal']>>
>;

export type RunPayoutContext = Awaited<ReturnType<BridgeRunContextOps['loadRunContext']>>;
export type ProcessItemInput = Parameters<BridgeTransferSubmitOps['processItem']>[0];
export type ProcessItemValidated = Exclude<
  Awaited<ReturnType<BridgeTransferPrepOps['validatePayoutInput']>>,
  PaymentResult
>;
export type ProcessItemBuilt = Awaited<ReturnType<BridgeTransferPrepOps['buildTransferOperation']>>;
