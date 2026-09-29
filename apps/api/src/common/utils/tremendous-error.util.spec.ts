import {
  isTremendousInsufficientFundsError,
  TREMENDOUS_SUPPORT_MESSAGE,
} from './tremendous-error.util';

describe('isTremendousInsufficientFundsError', () => {
  it.each([
    'Funding source has insufficient funds',
    'Insufficient funds',
    'Insufficient balance available',
    'The funding source does not have enough balance to cover this order',
    'Funding source balance is too low',
    'Your funding source balance is empty',
    'Available balance is insufficient to complete this request',
    'Order amount exceeds the remaining balance',
  ])('matches insufficient-funds message: %s', (message) => {
    expect(isTremendousInsufficientFundsError(message)).toBe(true);
  });

  it.each([
    'Product not found',
    'Invalid currency code',
    'Recipient email is invalid',
    'Tremendous request failed (500)',
    'Reward already redeemed',
    'Funding source is disabled',
  ])('ignores unrelated Tremendous errors: %s', (message) => {
    expect(isTremendousInsufficientFundsError(message)).toBe(false);
  });

  it('treats empty input as not-insufficient', () => {
    expect(isTremendousInsufficientFundsError(undefined)).toBe(false);
    expect(isTremendousInsufficientFundsError(null)).toBe(false);
    expect(isTremendousInsufficientFundsError('')).toBe(false);
  });

  it('points members at the support inbox', () => {
    expect(TREMENDOUS_SUPPORT_MESSAGE).toContain('info@paqadhr.com');
  });
});
