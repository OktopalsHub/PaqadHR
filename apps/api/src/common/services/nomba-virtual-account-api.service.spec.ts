import { BadRequestException } from '@nestjs/common';
import { NombaVirtualAccountApiService } from './nomba-virtual-account-api.service';

describe('NombaVirtualAccountApiService', () => {
  const mockTransferApi = {
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
  };

  beforeEach(() => {
    process.env.NOMBA_CLIENT_ID = 'client';
    process.env.NOMBA_CLIENT_SECRET = 'secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'acct-id';
    jest.restoreAllMocks();
    mockTransferApi.getAccessToken.mockResolvedValue('test-token');
  });

  afterEach(() => {
    delete process.env.NOMBA_CLIENT_ID;
    delete process.env.NOMBA_CLIENT_SECRET;
    delete process.env.NOMBA_PARENT_ACCOUNT_ID;
    delete process.env.NOMBA_SUB_ACCOUNT_ID;
  });

  it('creates a virtual account on the sub-account path when configured', async () => {
    process.env.NOMBA_SUB_ACCOUNT_ID = 'sub-acct-id';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '00',
        data: {
          bankAccountNumber: '9900012345',
          bankAccountName: 'Paqad Test',
          bankName: 'Nomba',
          accountRef: 'rewards_wallet_test',
        },
      }),
    } as Response);

    const service = new NombaVirtualAccountApiService(mockTransferApi as any);
    await service.createVirtualAccount({
      accountRef: 'rewards_wallet_test',
      accountName: 'Paqad Test Wallet',
      currency: 'NGN',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/accounts/virtual/sub-acct-id'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps bankAccountNumber from Nomba create response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '00',
        data: {
          bankAccountNumber: '91714245345',
          bankAccountName: 'Femi-Testing/Testing mike',
          bankName: 'Amucha MFB',
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

    expect(result.accountNumber).toBe('91714245345');
    expect(result.accountName).toBe('Femi-Testing/Testing mike');
    expect(result.bankName).toBe('Amucha MFB');
  });

  it('falls back to accountNumber when bankAccountNumber is absent', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
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
  });

  it('looks up existing account by accountRef on duplicate error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ description: 'Account ref already exists' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: '00',
          data: {
            results: [
              {
                bankAccountNumber: '9900099999',
                bankAccountName: 'Existing',
                bankName: 'Nomba',
                accountRef: 'rewards_wallet_dup',
              },
            ],
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
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/v1/accounts/virtual/list'),
      expect.objectContaining({ method: 'POST' }),
    );
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
