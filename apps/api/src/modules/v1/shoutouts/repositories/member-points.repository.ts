import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { ShoutoutMemberPoints } from '../entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../entities/shoutout-point-transaction.entity';

@Injectable()
export class MemberPointsRepository extends Repository<ShoutoutMemberPoints> {
  constructor(
    @InjectRepository(ShoutoutMemberPoints)
    private readonly memberPointsRepository: Repository<ShoutoutMemberPoints>,
    @InjectRepository(ShoutoutPointTransaction)
    private readonly transactionRepository: Repository<ShoutoutPointTransaction>,
  ) {
    super(
      memberPointsRepository.target,
      memberPointsRepository.manager,
      memberPointsRepository.queryRunner,
    );
  }

  async getByMember(
    tenantId: string,
    memberId: string,
    manager?: EntityManager,
  ): Promise<ShoutoutMemberPoints | null> {
    const repo = manager
      ? manager.getRepository(ShoutoutMemberPoints)
      : this.memberPointsRepository;
    return repo.findOne({ where: { tenantId, memberId } });
  }

  async listByTenant(tenantId: string): Promise<ShoutoutMemberPoints[]> {
    return this.find({
      where: { tenantId },
      relations: ['member'],
      order: { currentBalance: 'DESC' },
    });
  }

  async listTransactions(
    tenantId: string,
    memberId: string,
    page: number,
    limit: number,
  ): Promise<{ records: ShoutoutPointTransaction[]; total: number }> {
    const [records, total] = await this.transactionRepository.findAndCount({
      where: { tenantId, memberId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { records, total };
  }

  async sumPointsGivenSince(
    manager: EntityManager,
    tenantId: string,
    memberId: string,
    since: Date,
  ): Promise<number> {
    const result = await manager
      .getRepository(ShoutoutPointTransaction)
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(ABS(tx.points)), 0)', 'total')
      .where('tx.tenantId = :tenantId', { tenantId })
      .andWhere('tx.memberId = :memberId', { memberId })
      .andWhere('tx.type = :type', {
        type: ShoutoutPointTransactionType.GIVEN,
      })
      .andWhere('tx.createdAt >= :since', { since })
      .getRawOne<{ total: string }>();

    return parseInt(result?.total ?? '0', 10);
  }

  async insertTransaction(
    manager: EntityManager,
    data: {
      tenantId: string;
      memberId: string;
      type: ShoutoutPointTransactionType;
      points: number;
      runningBalance: number;
      shoutoutId?: string | null;
      description?: string | null;
      createdBy: string;
    },
  ): Promise<void> {
    const transaction = manager.create(ShoutoutPointTransaction, data);
    await manager.save(transaction);
  }
}
