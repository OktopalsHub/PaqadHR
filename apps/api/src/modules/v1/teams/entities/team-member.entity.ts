import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne
} from 'typeorm';
import { Team } from './team.entity';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('team_members')
export class TeamMember extends BaseEntity {
  @Column({ type: 'uuid', name: 'team_id' })
  teamId: string;
  @ManyToOne(() => Team, (team) => team.members)
  @JoinColumn({ name: 'team_id' })
  team: Team;
  @Column({ type: 'uuid', name: 'member_id' })
  memberId: string;
  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;
  @Column({ type: 'varchar', length: 32, nullable: true })
  role?: string;
}
