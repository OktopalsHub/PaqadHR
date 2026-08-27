import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { Address } from '../address/entities/address.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Document } from '../document/entities/document.entity';
import { EmergencyContact } from '../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../employment/entities/employment.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';
import { UserRetentionCronService } from './services/user-retention.cron';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Session,
      Account,
      TenantMember,
      PaymentMethod,
      Document,
      Address,
      EmergencyContact,
      Employment,
      AuditLog,
    ]),
    AuditLogsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, EmailHashService, UserRetentionCronService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
