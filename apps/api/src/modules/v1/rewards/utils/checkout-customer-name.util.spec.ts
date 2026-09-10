import { resolveCheckoutCustomerFullName } from './checkout-customer-name.util';

describe('resolveCheckoutCustomerFullName', () => {
  it('uses a multi-word tenant name', () => {
    expect(resolveCheckoutCustomerFullName('Acme Labs', 'a@b.com')).toBe('Acme Labs');
  });

  it('appends Workspace when tenant name is one word', () => {
    expect(resolveCheckoutCustomerFullName('Acme', 'a@b.com')).toBe('Acme Workspace');
  });

  it('builds a full name from email local part', () => {
    expect(resolveCheckoutCustomerFullName(null, 'daniel.mbazu@example.com')).toBe('daniel mbazu');
  });

  it('appends Account when email local is a single token', () => {
    expect(resolveCheckoutCustomerFullName('', 'daniel@example.com')).toBe('daniel Account');
  });
});
