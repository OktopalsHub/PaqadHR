import { mapNombaBillingFailure } from './nomba-billing-failure.util';

describe('mapNombaBillingFailure', () => {
  it('maps insufficient funds', () => {
    expect(mapNombaBillingFailure('Insufficient funds on card').code).toBe('insufficient_funds');
  });

  it('maps expired card', () => {
    expect(mapNombaBillingFailure('Card expired').code).toBe('card_expired');
  });

  it('maps authentication errors', () => {
    expect(mapNombaBillingFailure('3DS authentication required').code).toBe(
      'authentication_required',
    );
  });

  it('maps verification failures', () => {
    expect(mapNombaBillingFailure('verification_failed').code).toBe('verification_failed');
  });

  it('defaults to unknown', () => {
    expect(mapNombaBillingFailure('something weird').code).toBe('unknown');
  });
});
