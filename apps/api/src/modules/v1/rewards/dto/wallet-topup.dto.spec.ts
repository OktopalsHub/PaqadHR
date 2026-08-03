import { validateSync } from 'class-validator';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';
import { WalletAutoTopupDto } from './wallet-auto-topup.dto';
import { WalletTopupDto } from './wallet-topup.dto';

describe('WalletTopupDto', () => {
  it('accepts amounts up to the configured max', () => {
    const dto = Object.assign(new WalletTopupDto(), { amount: WALLET_TOPUP_MAX_AMOUNT });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects amounts above the configured max', () => {
    const dto = Object.assign(new WalletTopupDto(), { amount: WALLET_TOPUP_MAX_AMOUNT + 1 });
    expect(validateSync(dto).some((e) => e.property === 'amount')).toBe(true);
  });
});

describe('WalletAutoTopupDto', () => {
  it('rejects auto-topup amounts above the configured max', () => {
    const dto = Object.assign(new WalletAutoTopupDto(), {
      enabled: true,
      threshold: 1000,
      amount: WALLET_TOPUP_MAX_AMOUNT + 1,
    });
    expect(validateSync(dto).some((e) => e.property === 'amount')).toBe(true);
  });
});
