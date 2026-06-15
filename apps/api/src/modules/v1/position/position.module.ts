import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { PositionMemberService } from './services/position-member.service';
import { PositionService } from './services/position.service';
import { Position } from "./entities/position.entity";
import { PositionMember } from "./entities/position-member.entity";
import { PositionController } from "./controllers/position.controller";
import { PositionMemberController } from "./controllers/position-member.controller";
import { PositionMemberRepository } from "./repositories/position-member.repository";
import { PositionRepository } from "./repositories/position.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, PositionMember]),
    TenantMembersModule,
  ],
  controllers: [PositionController, PositionMemberController],
  providers: [
    PositionMemberRepository,
    PositionRepository,
    PositionService,
    PositionMemberService,
  ],
  exports: [PositionService, PositionMemberService],
})
export class PositionModule {}
