import type { ValueTransformer } from 'typeorm';

import { EncryptionService } from '../../../../common/services/encryption.service';
import type { VoucherInfo } from '../entities/reward-redemption.entity';

const SEALED_PREFIX = 'enc1.';
const SECRET_FIELDS = ['code', 'pin'] as const;

let encryption: EncryptionService | undefined;
const service = () => {
  encryption ??= new EncryptionService();
  return encryption;
};

const isSealed = (value: string) => value.startsWith(SEALED_PREFIX);

/** Encrypt the redeemable fields (code, pin); instructions stay readable. */
export function sealVoucher(voucher: VoucherInfo): VoucherInfo {
  const sealed: VoucherInfo = { ...voucher };
  for (const field of SECRET_FIELDS) {
    const value = sealed[field];
    if (value && !isSealed(value)) sealed[field] = SEALED_PREFIX + service().encrypt(value);
  }
  return sealed;
}

/** Decrypt sealed fields. Rows written before encryption existed are returned unchanged. */
export function openVoucher(voucher: VoucherInfo): VoucherInfo {
  const opened: VoucherInfo = { ...voucher };
  for (const field of SECRET_FIELDS) {
    const value = opened[field];
    if (value && isSealed(value)) opened[field] = service().decrypt(value.slice(SEALED_PREFIX.length));
  }
  return opened;
}

/** Applied to the voucher column so every write encrypts and every read decrypts. */
export const voucherTransformer: ValueTransformer = {
  to: (value: VoucherInfo | null | undefined) => (value ? sealVoucher(value) : value),
  from: (value: VoucherInfo | null | undefined) => (value ? openVoucher(value) : value),
};
