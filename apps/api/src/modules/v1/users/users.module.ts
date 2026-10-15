import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionModule } from 'src/common/modules/encryption.module';
import { FileModule } from 'src/common/modules/file.module';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, Account, Verification]),
    AuditLogsModule,
    FileModule,
    EncryptionModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, EmailHashService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
