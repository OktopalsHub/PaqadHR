import type { Repository } from 'typeorm';
import { TenantMember } from '../entities/tenant-member.entity';
import { TenantMemberRepository } from './tenant-members.repository';

describe('TenantMemberRepository', () => {
  it('counts active employees and distinct departments with active memberships', async () => {
    const tenantMemberRepository = {
      count: jest.fn().mockResolvedValue(3),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<TenantMember>;

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ count: '2' }),
    };

    tenantMemberRepository.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);

    const repository = new TenantMemberRepository(tenantMemberRepository);

    const result = await repository.getTenantMemberSummary('tenant-1');

    expect(tenantMemberRepository.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
    });
    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'member.departmentMemberships',
      'departmentMembership',
      'departmentMembership.isActive = :departmentActive',
      { departmentActive: true },
    );
    expect(queryBuilder.where).toHaveBeenCalledWith('member.tenantId = :tenantId', {
      tenantId: 'tenant-1',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'member.isActive = :memberActive',
      { memberActive: true },
    );
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'COUNT(DISTINCT departmentMembership.departmentId)',
      'count',
    );
    expect(result).toEqual({ activeEmployees: 3, departments: 2 });
  });
});
