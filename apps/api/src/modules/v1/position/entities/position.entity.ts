import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { Tenant } from "../../tenants/entities/tenant.entity";
import { PositionMember } from "./position-member.entity";
import { Employment } from "../../employment/entities/employment.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity()
export class Position extends BaseEntity {
  @Column()
  title: string;
  @Column({ nullable: true })
  department?: string;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant, (tenant) => tenant.positions)
  tenant: Tenant;
  @OneToMany(() => PositionMember, (memberPosition) => memberPosition.position)
  memberPositions: PositionMember[];
  @OneToMany('Employment', 'position')
  members: Employment[];
}
