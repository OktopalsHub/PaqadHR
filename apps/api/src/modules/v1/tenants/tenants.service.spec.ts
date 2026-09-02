import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';
import { TenantCounter } from '../tenant-members/entities/tenant-counter.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepository: {
    findById: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    findBySlug: jest.Mock;
    getTenantByIds: jest.Mock;
  };
  let tenantMemberService: {
    getActiveMembershipSummaries: jest.Mock;
    getUserMemberships?: jest.Mock;
  };
  let subscriptionsService: {
    getEntitlementsForTenants: jest.Mock;
  };
  let fileUrlService: {
    getTenantLogoUrl: jest.Mock;
  };
  let employmentRepository: {
    count: jest.Mock;
  };
  let walletRepository: {
    findOne: jest.Mock;
  };
  let walletTransactionRepository: {
    count: jest.Mock;
  };

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findBySlug: jest.fn(),
      getTenantByIds: jest.fn(),
    };
    tenantMemberService = {
      getActiveMembershipSummaries: jest.fn(),
    };
    subscriptionsService = {
      getEntitlementsForTenants: jest.fn(),
    };
    fileUrlService = {
      getTenantLogoUrl: jest.fn(),
    };
    employmentRepository = {
      count: jest.fn(),
    };
    walletRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    walletTransactionRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    service = new TenantsService(
      tenantRepository as never,
      tenantMemberService as never,
      subscriptionsService as never,
      {} as never,
      {} as never,
      fileUrlService as never,
      employmentRepository as never,
      walletRepository as never,
      walletTransactionRepository as never,
      { queueAuditLog: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
    );
  });

  describe('getSessionWorkspaces', () => {
    it('returns an empty list when the user has no active memberships', async () => {
      tenantMemberService.getActiveMembershipSummaries.mockResolvedValue([]);

      await expect(service.getSessionWorkspaces('user-1')).resolves.toEqual([]);
      expect(tenantRepository.getTenantByIds).not.toHaveBeenCalled();
      expect(subscriptionsService.getEntitlementsForTenants).not.toHaveBeenCalled();
    });

    it('maps active memberships to workspaces with entitlement defaults', async () => {
      tenantMemberService.getActiveMembershipSummaries.mockResolvedValue([
        {
          id: 'member-1',
          tenantId: 'tenant-1',
          role: TenantMemberRole.OWNER,
          isActive: true,
        },
        {
          id: 'member-2',
          tenantId: 'tenant-2',
          role: TenantMemberRole.MEMBER,
          isActive: true,
        },
      ]);
      tenantRepository.getTenantByIds.mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Acme',
          slug: 'acme',
          isActive: true,
          logoKey: 'logo.png',
          timezone: 'Africa/Lagos',
          preferredCurrency: 'NGN',
          countryCode: 'NG',
        },
        {
          id: 'tenant-2',
          name: 'Beta',
          slug: 'beta-team',
          isActive: true,
          logoKey: null,
          timezone: 'UTC',
          preferredCurrency: 'USD',
          countryCode: 'US',
        },
      ]);
      subscriptionsService.getEntitlementsForTenants.mockResolvedValue(
        new Map([['tenant-1', { entitled: true, needsPayment: false, plan: 'growth' }]]),
      );
      fileUrlService.getTenantLogoUrl.mockReturnValue('https://cdn.example.com/acme/logo.png');

      const workspaces = await service.getSessionWorkspaces('user-1');

      expect(tenantRepository.getTenantByIds).toHaveBeenCalledWith(['tenant-1', 'tenant-2']);
      expect(subscriptionsService.getEntitlementsForTenants).toHaveBeenCalledWith([
        'tenant-1',
        'tenant-2',
      ]);
      expect(workspaces).toEqual([
        {
          id: 'tenant-1',
          name: 'Acme',
          slug: 'acme',
          isActive: true,
          logoUrl: 'https://cdn.example.com/acme/logo.png',
          timezone: 'Africa/Lagos',
          preferredCurrency: 'NGN',
          countryCode: 'NG',
          member: {
            id: 'member-1',
            role: TenantMemberRole.OWNER,
            isActive: true,
          },
          entitled: true,
          needsPayment: false,
          plan: 'growth',
        },
        {
          id: 'tenant-2',
          name: 'Beta',
          slug: 'beta-team',
          isActive: true,
          logoUrl: undefined,
          timezone: 'UTC',
          preferredCurrency: 'USD',
          countryCode: 'US',
          member: {
            id: 'member-2',
            role: TenantMemberRole.MEMBER,
            isActive: true,
          },
          entitled: false,
          needsPayment: true,
          plan: null,
        },
      ]);
    });

    it('skips tenants that do not match an active membership', async () => {
      tenantMemberService.getActiveMembershipSummaries.mockResolvedValue([
        {
          id: 'member-1',
          tenantId: 'tenant-1',
          role: TenantMemberRole.OWNER,
          isActive: true,
        },
      ]);
      tenantRepository.getTenantByIds.mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Acme',
          slug: 'acme',
          isActive: true,
          logoKey: null,
          timezone: 'UTC',
          preferredCurrency: 'USD',
          countryCode: 'US',
        },
        {
          id: 'tenant-orphan',
          name: 'Orphan',
          slug: 'orphan',
          isActive: true,
          logoKey: null,
          timezone: 'UTC',
          preferredCurrency: 'USD',
          countryCode: 'US',
        },
      ]);
      subscriptionsService.getEntitlementsForTenants.mockResolvedValue(new Map());

      const workspaces = await service.getSessionWorkspaces('user-1');

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]?.id).toBe('tenant-1');
    });
  });

  describe('updateTenant', () => {
    it('updates timezone without changing country', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
      });
      tenantRepository.findOne.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
        timezone: 'Africa/Lagos',
      });

      const result = await service.updateTenant('tenant-1', {
        timezone: 'Africa/Lagos',
      });

      expect(tenantRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          timezone: 'Africa/Lagos',
          slug: 'acme',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          countryCode: 'US',
          timezone: 'Africa/Lagos',
        }),
      );
    });

    it('throws when the tenant does not exist', async () => {
      tenantRepository.findById.mockResolvedValue(null);

      await expect(service.updateTenant('tenant-1', { timezone: 'UTC' })).rejects.toThrow(
        new NotFoundException('Tenant does not exist'),
      );
    });

    it('rejects reserved slugs during updates', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
      });

      await expect(service.updateTenant('tenant-1', { slug: 'api' })).rejects.toThrow(
        new UnprocessableEntityException('The subdomain "api" is reserved and cannot be used.'),
      );

      expect(tenantRepository.update).not.toHaveBeenCalled();
    });

    it('blocks preferredCurrency change when rewards wallet is funded', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
      });
      employmentRepository.count.mockResolvedValue(0);
      walletRepository.findOne.mockResolvedValue({
        id: 'wallet-1',
        currencyCode: 'USD',
        balanceAmount: 2500,
      });
      walletTransactionRepository.count.mockResolvedValue(0);

      await expect(service.updateTenant('tenant-1', { preferredCurrency: 'EUR' })).rejects.toThrow(
        new BadRequestException(
          'Rewards wallet has activity in USD. Spend the balance before changing workspace currency.',
        ),
      );

      expect(tenantRepository.update).not.toHaveBeenCalled();
    });

    it('allows non-currency updates when rewards wallet is funded', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'NGN',
        countryCode: 'NG',
        name: 'Acme',
      });
      walletRepository.findOne.mockResolvedValue({
        id: 'wallet-1',
        currencyCode: 'NGN',
        balanceAmount: 5000,
      });
      walletTransactionRepository.count.mockResolvedValue(2);
      tenantRepository.findOne.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'NGN',
        countryCode: 'NG',
        name: 'Acme HR',
      });

      await expect(
        service.updateTenant('tenant-1', { name: 'Acme HR', preferredCurrency: 'NGN' }),
      ).resolves.toEqual(expect.objectContaining({ name: 'Acme HR', preferredCurrency: 'NGN' }));

      expect(tenantRepository.update).toHaveBeenCalled();
    });
  });

  describe('createTenant', () => {
    let userService: { getUser: jest.Mock };
    let eventEmitter: { emit: jest.Mock };
    let dataSource: { transaction: jest.Mock };
    let auditLogsService: { queueAuditLog: jest.Mock };
    let savedMember: Record<string, unknown> | undefined;

    beforeEach(() => {
      savedMember = undefined;
      userService = {
        getUser: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Jane Doe' }),
      };
      tenantMemberService.getUserMemberships = jest
        .fn()
        .mockResolvedValue([{ firstName: 'Copied', lastName: 'Name', preferredName: 'Copied' }]);
      tenantRepository.findBySlug = jest.fn().mockResolvedValue(null);

      const tenantRepo = {
        create: jest.fn((data) => data),
        save: jest.fn(async (data) => ({ ...data, id: 'tenant-new' })),
      };
      const memberRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((data) => data),
        save: jest.fn(async (data) => {
          savedMember = data;
          return { ...data, id: 'member-new', joinDate: new Date() };
        }),
      };
      const counterRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((data) => data),
        save: jest.fn(async (data) => data),
      };
      const settingsRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource = {
        transaction: jest.fn(async (cb) =>
          cb({
            getRepository: jest.fn((entity) => {
              if (entity === Tenant) return tenantRepo;
              if (entity === TenantMember) return memberRepo;
              if (entity === TenantCounter) return counterRepo;
              if (entity === TenantSettings) return settingsRepo;
              throw new Error(`Unexpected repository for ${String(entity)}`);
            }),
          }),
        ),
      };

      eventEmitter = { emit: jest.fn() };
      auditLogsService = { queueAuditLog: jest.fn().mockResolvedValue(undefined) };

      service = new TenantsService(
        tenantRepository as never,
        tenantMemberService as never,
        subscriptionsService as never,
        userService as never,
        eventEmitter as never,
        fileUrlService as never,
        employmentRepository as never,
        walletRepository as never,
        walletTransactionRepository as never,
        auditLogsService as never,
        dataSource as never,
      );
    });

    it('does not copy profile names from other workspace memberships', async () => {
      await service.createTenant('user-1', { name: 'New Workspace', slug: 'new-workspace' });

      expect(tenantMemberService.getUserMemberships).not.toHaveBeenCalled();
      expect(savedMember).toEqual(
        expect.objectContaining({
          firstName: null,
          lastName: null,
          preferredName: null,
          role: TenantMemberRole.OWNER,
        }),
      );
    });
  });
});
