import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionModule } from '../../../common/modules/encryption.module';
import { FileModule } from '../../../common/modules/file.module';
import { Address } from '../address/entities/address.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Department } from '../departments/entities/department.entity';
import { DepartmentMember } from '../departments/entities/department-member.entity';
import { Document } from '../document/entities/document.entity';
import { Education } from '../education/entities/education.entity';
import { EmergencyContact } from '../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../employment/entities/employment.entity';
import { Leave } from '../leave/entities/leave.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { PaymentMethod } from '../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../payroll/entities/payroll-item.entity';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantCounter } from './entities/tenant-counter.entity';
import { TenantMember } from './entities/tenant-member.entity';
import { HeaderTenantMemberGuard } from './guards/header-tenant-member.guard';
import { TenantMemberGuard } from './guards/tenant-members.guards';
import { PublicTenantMembersController } from './public-tenant-members.controller';
import { TenantCounterRepository } from './repositories/tenant-counter.repository';
import { TenantMemberRepository } from './repositories/tenant-members.repository';
import { TenantMembersController } from './tenant-members.controller';
import { TenantMembersService } from './tenant-members.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantMember,
      TenantCounter,
      Tenant,
      TenantSettings,
      Employment,
      DepartmentMember,
      Department,
      Address,
      Attendance,
      Document,
      Education,
      EmergencyContact,
      Leave,
      Notification,
      NotificationPreference,
      PaymentMethod,
      PayrollItem,
    ]),
    FileModule,
    EncryptionModule,
  ],
  controllers: [TenantMembersController, PublicTenantMembersController],
  providers: [
    TenantMembersService,
    TenantMemberRepository,
    TenantCounterRepository,
    TenantMemberGuard,
    HeaderTenantMemberGuard,
  ],
  exports: [TenantMembersService, TenantMemberGuard, HeaderTenantMemberGuard, TypeOrmModule],
})
export class TenantMembersModule {}
