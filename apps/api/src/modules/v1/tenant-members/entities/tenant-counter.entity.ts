import {
  Column,
  Entity,
  Index
} from 'typeorm';
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('tenant_counters')
@Index(['tenantId', 'counterType'], { unique: true })
export class TenantCounter extends BaseEntity {
  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;
  @Column({ name: 'counter_type' })
  counterType: string; 
  @Column({ name: 'current_value', default: 0 })
  currentValue: number;
  @Column({ name: 'prefix', nullable: true })
  prefix?: string;
  @Column({ name: 'suffix', nullable: true })
  suffix?: string;
  @Column({ name: 'padding_length', default: 3 })
  paddingLength: number;

  getNextFormattedValue(): string {
    const nextValue = this.currentValue + 1;
    const paddedValue = nextValue.toString().padStart(this.paddingLength, '0');
    return `${this.prefix || ''}${paddedValue}${this.suffix || ''}`;
  }
  incrementAndFormat(): string {
    this.currentValue++;
    return this.getFormattedValue();
  }
  getFormattedValue(): string {
    const paddedValue = this.currentValue
      .toString()
      .padStart(this.paddingLength, '0');
    return `${this.prefix || ''}${paddedValue}${this.suffix || ''}`;
  }
}
