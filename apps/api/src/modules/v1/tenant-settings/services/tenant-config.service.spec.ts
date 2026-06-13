import { Test, TestingModule } from '@nestjs/testing';
import { TenantConfigService } from './tenant-config.service';
import { TenantSettingRepository } from './tenant-setting.repository';

describe('TenantConfigService (shoutout points)', () => {
  let service: TenantConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantConfigService,
        {
          provide: TenantSettingRepository,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              settings: {
                points: {
                  dailyLimit: 50,
                  monthlyLimit: 200,
                },
              },
            }),
          },
        },
      ],
    }).compile();

    service = module.get(TenantConfigService);
  });

  it('allows points within daily and monthly limits', async () => {
    const result = await service.validatePointsOperation(
      'tenant-1',
      10,
      40,
      5,
    );
    expect(result.isValid).toBe(true);
  });

  it('blocks when daily limit would be exceeded', async () => {
    const result = await service.validatePointsOperation(
      'tenant-1',
      48,
      40,
      5,
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('daily limit');
  });
});
