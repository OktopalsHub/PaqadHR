import { Column, DeleteDateColumn, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

@Entity()
export class Address extends BaseEntity {
  @Column()
  country: string;
  @Column({})
  city: string;
  @Column({})
  state: string;
  @Column({
    nullable: true,
  })
  street: string;
  @Column({
    name: 'postal_code',
    nullable: true,
  })
  postalCode: string;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(
    () => TenantMember,
    (tenantMember) => tenantMember.address,
  )
  tenantMember: TenantMember;
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
