import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerAccessModule } from 'src/common/modules/manager-access.module';

import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { PositionMemberController } from './controllers/position-member.controller';
import { PositionController } from './controllers/position.controller';
import { PositionMember } from './entities/position-member.entity';
import { Position } from './entities/position.entity';
import { PositionMemberRepository } from './repositories/position-member.repository';
import { PositionRepository } from './repositories/position.repository';
import { PositionMemberService } from './services/position-member.service';
import { PositionService } from './services/position.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, PositionMember]),
    TenantMembersModule,
    ManagerAccessModule,
    ActivitiesModule,
  ],
  controllers: [PositionController, PositionMemberController],
  providers: [PositionMemberRepository, PositionRepository, PositionService, PositionMemberService],
  exports: [PositionService, PositionMemberService],
})
export class PositionModule {}
