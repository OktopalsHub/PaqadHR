import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionModule } from 'src/common/modules/encryption.module';
import { FileModule } from 'src/common/modules/file.module';
import { EmailHashService } from 'src/common/services/email-hash.service';
import { Address } from '../address/entities/address.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Account } from '../auth/entities/account.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { Document } from '../document/entities/document.entity';
import { Education } from '../education/entities/education.entity';
import { EmergencyContact } from '../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../employment/entities/employment.entity';
import { Leave } from '../leave/entities/leave.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';
import { TenantMember } from '../tenant-members/entities/tenant-member.entity';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Session,
      Account,
      Verification,
      TenantMember,
      PaymentMethod,
      Employment,
      Document,
      Leave,
      Attendance,
      Education,
      EmergencyContact,
      Address,
      PayrollItem,
      NotificationPreference,
      Notification,
    ]),
    AuditLogsModule,
    FileModule,
    EncryptionModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, EmailHashService],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
