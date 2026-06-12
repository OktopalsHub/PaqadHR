import { Exclude } from 'class-transformer';
import { UserRole } from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  OneToMany,
} from 'typeorm';
import { Account } from '../../auth/entities/account.entity';
import { Session } from '../../auth/entities/session.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('user')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password?: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode?: string | null;

  @Column({ name: 'image_key', type: 'varchar', nullable: true })
  imageKey?: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'varchar', length: 20, default: UserRole.BASIC })
  role: string;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Account, (account) => account.user)
  accounts: Account[];

  @OneToMany(() => Tenant, (tenant) => tenant.createdBy)
  tenants: Tenant[];

  @OneToMany(() => TenantMember, (tenantMember) => tenantMember.user)
  tenantMembers: TenantMember[];

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  deletedAt?: Date | null;
}
