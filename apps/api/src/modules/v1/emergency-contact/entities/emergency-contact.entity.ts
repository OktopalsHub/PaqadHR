import { RelationshipType } from 'src/common/enums';
import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
export class EmergencyContact extends BaseEntity {
  @Column()
  fullName: string;
  @Column({})
  phoneNumber: string;
  @Column({
    nullable: true,
  })
  email?: string;
  @Column({ type: 'enum', enum: RelationshipType })
  relationship: RelationshipType;
  @Column({
    type: 'text',
    nullable: true,
  })
  address?: string;
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.emergencyContacts,
  )
  tenantMember: TenantMember;
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.emergencyContacts,
  )
  tenant: Tenant;
}
