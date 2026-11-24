import { ClaimRewardDto } from './claim-reward.dto';
import { failedProperties, validationErrors } from './validate-dto.testing';

const valid = {
  rewardType: 'NOMBA_AIRTIME',
  rewardId: 'airtime-ng',
  pointsCost: 500,
  currencyValue: 500,
  recipientPhone: '08012345678',
  airtimeNetwork: 'MTN',
  topupKind: 'airtime',
  idempotencyKey: '3f2b8c1e-6a4d-4c8e-9b1a-2d7e5f0a9c11',
};

describe('ClaimRewardDto', () => {
  it('accepts a valid claim', () => {
    expect(validationErrors(ClaimRewardDto, valid)).toHaveLength(0);
  });

  it('accepts numeric billerId', () => {
    expect(validationErrors(ClaimRewardDto, { ...valid, billerId: 12 })).toHaveLength(0);
  });

  it('rejects unknown fields', () => {
    expect(failedProperties(ClaimRewardDto, { ...valid, tenantId: 'x' })).toContain('tenantId');
  });

  it.each([-1, Number.NaN, '5', 1.5])('rejects pointsCost %p', (pointsCost) => {
    expect(failedProperties(ClaimRewardDto, { ...valid, pointsCost })).toContain('pointsCost');
  });

  it.each([-1, Number.NaN, '5', 1e12])('rejects currencyValue %p', (currencyValue) => {
    expect(failedProperties(ClaimRewardDto, { ...valid, currencyValue })).toContain(
      'currencyValue',
    );
  });

  it('rejects an unknown rewardType', () => {
    expect(failedProperties(ClaimRewardDto, { ...valid, rewardType: 'X' })).toContain('rewardType');
  });

  it('rejects a non-uuid idempotencyKey', () => {
    expect(failedProperties(ClaimRewardDto, { ...valid, idempotencyKey: 'abc' })).toContain(
      'idempotencyKey',
    );
  });

  it('rejects a bad email and network', () => {
    const props = failedProperties(ClaimRewardDto, {
      ...valid,
      recipientEmail: 'no',
      airtimeNetwork: 'FOO',
    });
    expect(props).toEqual(expect.arrayContaining(['recipientEmail', 'airtimeNetwork']));
  });
});
