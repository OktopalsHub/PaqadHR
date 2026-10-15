import { isWalletMoneyPath } from './express.config';

describe('isWalletMoneyPath', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('matches wallet topup', () => {
    expect(isWalletMoneyPath(`/api/v1/tenants/${tenantId}/rewards/wallet/topup`)).toBe(true);
  });

  it('matches wallet topup checkout with optional trailing slash', () => {
    expect(isWalletMoneyPath(`/api/v1/tenants/${tenantId}/rewards/wallet/topup/checkout`)).toBe(
      true,
    );
    expect(isWalletMoneyPath(`/api/v1/tenants/${tenantId}/rewards/wallet/topup/checkout/`)).toBe(
      true,
    );
  });

  it('does not match wallet GET or non-wallet paths', () => {
    expect(isWalletMoneyPath(`/api/v1/tenants/${tenantId}/rewards/wallet`)).toBe(false);
    expect(isWalletMoneyPath(`/api/v1/tenants/${tenantId}/rewards/catalog`)).toBe(false);
    expect(isWalletMoneyPath('/api/v1/webhooks/nomba')).toBe(false);
  });
});
