import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Plan } from './plan.entity';
import { PlanRegionalConfig } from "../../../../common/interfaces/plan-regional-config.interface";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity({ name: 'plan_prices' })
@Index(['planId', 'countryCode', 'currency'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class PlanPrice extends BaseEntity {
  @ManyToOne(() => Plan, (plan) => plan.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;
  @Column({ name: 'plan_id' })
  planId: string;
  @Column({ type: 'varchar', length: 3 })
  currency: string;
  @Column({ name: 'country_code', type: 'varchar', length: 10, default: 'GLOBAL' })
  countryCode: string;
  @Column({
    name: 'monthly_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  monthlyPrice: number;
  @Column({
    name: 'yearly_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  yearlyPrice: number;
  @Column({
    name: 'nomba_plan_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  nombaPlanId: string | null;
  @Column({ name: 'regional_config', type: 'jsonb', default: {} })
  regionalConfig: PlanRegionalConfig;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  get config(): PlanRegionalConfig {
    return this.regionalConfig ?? ({} as PlanRegionalConfig);
  }
  calculateMonthlyPrice(userCount: number): {
    basePrice: number;
    overagePrice: number;
    totalPrice: number;
    overageUsers: number;
  } {
    const cfg = this.config;
    const overageUsers = Math.max(0, userCount - (cfg.includedUsers ?? 0));
    const basePrice =
      Math.max(userCount, cfg.minimumUsers ?? 1) * (cfg.pricePerUser ?? 0);
    const overagePrice = overageUsers * (cfg.overagePricePerUser ?? 0);
    return {
      basePrice,
      overagePrice,
      totalPrice: basePrice + overagePrice,
      overageUsers,
    };
  }
}
