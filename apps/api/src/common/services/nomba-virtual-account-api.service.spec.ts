import { BadRequestException } from '@nestjs/common';
import { NombaVirtualAccountApiService } from './nomba-virtual-account-api.service';

describe('NombaVirtualAccountApiService', () => {
  const mockTransferApi = {
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
  };

  beforeEach(() => {
    process.env.NOMBA_CLIENT_ID = 'client';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_ACCOUNT_ID = 'acct-id';
    jest.restoreAllMocks();
    mockTransferApi.getAccessToken.mockResolvedValue('test-token');
  });

  afterEach(() => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_ACCOUNT_ID;
  });

  it('creates a virtual account', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '00',
        data: {
          accountNumber: '9900012345',
          accountName: 'Paqad Test',
          bankName: 'Nomba',
          accountRef: 'rewards_wallet_test',
        },
      }),
    } as Response);

    const service = new NombaVirtualAccountApiService(mockTransferApi as any);
    const result = await service.createVirtualAccount({
      accountRef: 'rewards_wallet_test',
      accountName: 'Paqad Test Wallet',
      currency: 'NGN',
    });

    expect(result.accountNumber).toBe('9900012345');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/accounts/virtual'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches existing account on duplicate ref error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ description: 'Account ref already exists' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: '00',
          data: {
            accountNumber: '9900099999',
            accountName: 'Existing',
            bankName: 'Nomba',
            accountRef: 'rewards_wallet_dup',
          },
        }),
      } as Response);

    const service = new NombaVirtualAccountApiService(mockTransferApi as any);
    const result = await service.createVirtualAccount({
      accountRef: 'rewards_wallet_dup',
      accountName: 'Paqad Existing',
      currency: 'NGN',
    });

    expect(result.accountNumber).toBe('9900099999');
  });

  it('throws when not configured', async () => {
    delete process.env.NOMBA_CLIENT_ID;
    const service = new NombaVirtualAccountApiService(mockTransferApi as any);
    await expect(
      service.createVirtualAccount({
        accountRef: 'rewards_wallet_x',
        accountName: 'Paqad Test',
        currency: 'NGN',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
