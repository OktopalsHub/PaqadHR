import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCounter } from '../entities/tenant-counter.entity';

@Injectable()
export class TenantCounterRepository extends Repository<TenantCounter> {
  constructor(
    @InjectRepository(TenantCounter)
    private readonly tenantCounterRepository: Repository<TenantCounter>,
  ) {
    super(
      tenantCounterRepository.target,
      tenantCounterRepository.manager,
      tenantCounterRepository.queryRunner,
    );
  }
  async getOrCreateCounter(
    tenantId: string,
    counterType: string,
    initialValue: number = 0,
    prefix?: string,
    suffix?: string,
    paddingLength: number = 3,
  ): Promise<TenantCounter> {
    let counter = await this.find({
      where: { tenantId, counterType },
    });
    if (!counter || counter.length === 0) {
      counter = [
        await this.save({
          tenantId,
          counterType,
          currentValue: initialValue,
          prefix,
          suffix,
          paddingLength,
        }),
      ];
    }
    return counter[0];
  }
  async incrementCounter(tenantId: string, counterType: string): Promise<string> {
    return this.tenantCounterRepository.manager.transaction(async (manager) => {
      const counter = await manager
        .createQueryBuilder(TenantCounter, 'counter')
        .setLock('pessimistic_write')
        .where('counter.tenantId = :tenantId', { tenantId })
        .andWhere('counter.counterType = :counterType', { counterType })
        .getOne();
      if (!counter) {
        const newCounter = manager.create(TenantCounter, {
          tenantId,
          counterType,
          currentValue: 1,
          paddingLength: 3,
        });
        await manager.save(newCounter);
        return newCounter.getFormattedValue();
      }
      counter.currentValue++;
      await manager.save(counter);
      return counter.getFormattedValue();
    });
  }
  async getNextValue(tenantId: string, counterType: string): Promise<string> {
    const counter = await this.getOrCreateCounter(tenantId, counterType);
    return counter.getNextFormattedValue();
  }
  async resetCounter(
    tenantId: string,
    counterType: string,
    newValue: number,
  ): Promise<TenantCounter | null> {
    const counter = await this.getOrCreateCounter(tenantId, counterType);
    await this.update(counter.id, { currentValue: newValue });
    return this.findOne({ where: { id: counter.id } });
  }
  async getCurrentValue(tenantId: string, counterType: string): Promise<number> {
    const counter = await this.getOrCreateCounter(tenantId, counterType);
    return counter.currentValue;
  }
}
