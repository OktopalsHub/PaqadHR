import { BadRequestException } from '@nestjs/common';
import { BachsApiError } from 'src/common/services/bachs-api.service';
import { NigerianBankService } from './nigerian-bank.service';

type Deps = {
  bachs?: {
    isConfigured: jest.Mock;
    listBanks: jest.Mock;
    resolveBankAccount: jest.Mock;
  };
  nomba?: { isConfigured: jest.Mock; listBanks: jest.Mock; lookupBankAccount: jest.Mock };
  monnify?: { isConfigured: jest.Mock; listBanks: jest.Mock; lookupBankAccount: jest.Mock };
};

function build(deps: Deps = {}) {
  const bachs = {
    isConfigured: jest.fn().mockReturnValue(false),
    listBanks: jest.fn(),
    resolveBankAccount: jest.fn(),
    ...deps.bachs,
  };
  const nomba = {
    isConfigured: jest.fn().mockReturnValue(false),
    listBanks: jest.fn(),
    lookupBankAccount: jest.fn(),
    ...deps.nomba,
  };
  const monnify = {
    isConfigured: jest.fn().mockReturnValue(false),
    listBanks: jest.fn(),
    lookupBankAccount: jest.fn(),
    ...deps.monnify,
  };
  const service = new NigerianBankService(bachs as never, nomba as never, monnify as never);
  return { service, bachs, nomba, monnify };
}

describe('NigerianBankService', () => {
  describe('listBanks', () => {
    it('uses the Bachs reference list by default and merges Nomba logos', async () => {
      const { service, monnify } = build({
        bachs: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn().mockResolvedValue({
            country: 'NG',
            banks: [
              { name: 'Sterling Bank', code: '232' },
              { name: 'Providus Bank', code: '101' },
            ],
          }),
          resolveBankAccount: jest.fn(),
        },
        nomba: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest
            .fn()
            .mockResolvedValue([
              { code: '232', name: 'Sterling Bank', logoUrl: 'https://cdn.example/sterling.png' },
            ]),
          lookupBankAccount: jest.fn(),
        },
        monnify: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn().mockResolvedValue([{ code: '999992', name: 'Opay' }]),
          lookupBankAccount: jest.fn(),
        },
      });

      const banks = await service.listBanks();

      expect(banks.map((b) => b.code)).toEqual(['101', '232']);
      expect(banks[1].logoUrl).toBe('https://cdn.example/sterling.png');
      expect(monnify.listBanks).not.toHaveBeenCalled();
    });

    it('falls back to Monnify when the Bachs list fails', async () => {
      const { service, monnify } = build({
        bachs: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn().mockRejectedValue(new Error('bachs down')),
          resolveBankAccount: jest.fn(),
        },
        monnify: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn().mockResolvedValue([{ code: '058', name: 'GTBank' }]),
          lookupBankAccount: jest.fn(),
        },
      });

      const banks = await service.listBanks();

      expect(banks).toEqual([{ code: '058', name: 'GTBank' }]);
      expect(monnify.listBanks).toHaveBeenCalled();
    });

    it('falls back to the static NIP list when nothing is configured', async () => {
      const { service } = build();

      const banks = await service.listBanks();

      expect(banks.length).toBeGreaterThan(0);
      expect(banks.every((b) => b.code && b.name)).toBe(true);
    });
  });

  describe('lookupBankAccount', () => {
    it('resolves through Bachs against the NG reference codes', async () => {
      const { service, bachs, monnify } = build({
        bachs: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          resolveBankAccount: jest.fn().mockResolvedValue({
            resolved: true,
            accountName: 'ADA OKAFOR',
            accountNumber: '0123456789',
            message: null,
          }),
        },
        monnify: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          lookupBankAccount: jest.fn(),
        },
      });

      const result = await service.lookupBankAccount('0123456789', '101', 'Providus Bank');

      expect(bachs.resolveBankAccount).toHaveBeenCalledWith({
        accountNumber: '0123456789',
        bankCode: '101',
        country: 'NG',
      });
      expect(result).toEqual({
        accountNumber: '0123456789',
        accountName: 'ADA OKAFOR',
        bankCode: '101',
        bankName: 'Providus Bank',
      });
      expect(monnify.lookupBankAccount).not.toHaveBeenCalled();
    });

    it('treats resolved:false as a rejection and does not fall through', async () => {
      const { service, monnify } = build({
        bachs: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          resolveBankAccount: jest.fn().mockResolvedValue({
            resolved: false,
            accountName: null,
            accountNumber: null,
            message: 'Account number not found',
          }),
        },
        monnify: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          lookupBankAccount: jest.fn(),
        },
      });

      await expect(service.lookupBankAccount('0123456789', '101')).rejects.toThrow(
        'Account number not found',
      );
      expect(monnify.lookupBankAccount).not.toHaveBeenCalled();
    });

    it('falls through to the next provider when Bachs is unavailable', async () => {
      const { service, monnify } = build({
        bachs: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          resolveBankAccount: jest
            .fn()
            .mockRejectedValue(new BachsApiError('Invalid API key', 'UNAUTHORIZED', 401)),
        },
        monnify: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          lookupBankAccount: jest.fn().mockResolvedValue({
            accountNumber: '0123456789',
            accountName: 'ADA OKAFOR',
          }),
        },
      });

      const result = await service.lookupBankAccount('0123456789', '101');

      expect(result.accountName).toBe('ADA OKAFOR');
      expect(monnify.lookupBankAccount).toHaveBeenCalled();
    });

    it('rejects account numbers that are not 10 digits before calling any provider', async () => {
      const { service, bachs } = build({
        bachs: {
          isConfigured: jest.fn().mockReturnValue(true),
          listBanks: jest.fn(),
          resolveBankAccount: jest.fn(),
        },
      });

      await expect(service.lookupBankAccount('12345', '101')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(bachs.resolveBankAccount).not.toHaveBeenCalled();
    });
  });
});
