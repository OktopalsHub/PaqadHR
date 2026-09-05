import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from 'src/common/modules/file.module';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, Account, Verification]),
    // Users ↔ TenantMembers ↔ Invitations cycle; defer until Nest scans.
    forwardRef(() => TenantMembersModule),
    AuditLogsModule,
    FileModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, EmailHashService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
