import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('leave_policies')
export class LeavePolicy extends BaseEntity {
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @OneToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ name: 'allow_carryover', default: false })
  allowCarryover: boolean;
  @Column({ name: 'max_carryover_days', default: 0 })
  maxCarryoverDays: number;
  @Column({ name: 'carryover_expiry_months', nullable: true })
  carryoverExpiryMonths?: number;
  @Column({ name: 'auto_create_annual_balances', default: true })
  autoCreateAnnualBalances: boolean;
  @Column({ name: 'prorate_for_new_joiners', default: true })
  prorateForNewJoiners: boolean;
}
