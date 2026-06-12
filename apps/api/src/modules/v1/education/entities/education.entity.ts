import { Column, Entity, ManyToOne } from 'typeorm';
import { DegreeType } from 'src/common/enums';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity()
export class Education extends BaseEntity {
  @Column()
  title: string;
  @Column({ type: 'enum', enum: DegreeType })
  degreeType: DegreeType;
  @Column()
  institution: string;
  @Column({ nullable: true })
  fieldOfStudy?: string;
  @Column({ type: 'date', nullable: true })
  startDate?: Date;
  @Column({ type: 'date', nullable: true })
  endDate?: Date;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({ nullable: true })
  gpa?: string;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => TenantMember, (member) => member.educations)
  tenantMember: TenantMember;
  @ManyToOne(() => Tenant, (tenant) => tenant.educations)
  tenant: Tenant;
}
