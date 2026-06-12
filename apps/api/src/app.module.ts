import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { TypeOrmModule } from '@nestjs/typeorm';
import { pinoLoggerConfig } from './common/logger/pino-logger.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { dataSourceOptions } from './common/config';
import { JwtAuthGuard } from './common/guards';
import { TenantGuard } from './common/guards/tenant.guard';
import { AuthModule } from "./modules/v1/auth/auth.module";
import { UsersModule } from "./modules/v1/users/users.module";
import { TenantsModule } from "./modules/v1/tenants/tenants.module";
import { TenantMembersModule } from "./modules/v1/tenant-members/tenant-members.module";
import { TenantSettingsModule } from "./modules/v1/tenant-settings/tenant-settings.module";
import { InvitationsModule } from "./modules/v1/invitations/invitations.module";
import { AddressModule } from "./modules/v1/address/address.module";
import { LeaveTypeModule } from "./modules/v1/leave-type/leave-type.module";
import { LeaveModule } from "./modules/v1/leave/leave.module";
import { LeaveBalanceModule } from "./modules/v1/leave-balance/leave-balance.module";
import { AssetsModule } from "./modules/v1/assets/assets.module";
import { AssetAssignmentModule } from "./modules/v1/assets/assignment/asset-assignment.module";
import { AssetMaintenanceModule } from "./modules/v1/assets/maintenance/asset-maintenance.module";
import { AssetCategoryModule } from "./modules/v1/assets/category/asset-category.module";
import { AssetDocumentModule } from "./modules/v1/assets/document/asset-document.module";
import { DepartmentsModule } from "./modules/v1/departments/departments.module";
import { PositionModule } from "./modules/v1/position/position.module";
import { EmploymentModule } from "./modules/v1/employment/employment.module";
import { DocumentModule } from "./modules/v1/document/document.module";
import { AttendanceModule } from "./modules/v1/attendance/attendance.module";
import { EmergencyContactModule } from "./modules/v1/emergency-contact/emergency-contact.module";
import { EducationModule } from "./modules/v1/education/education.module";
import { RecruitmentModule } from "./modules/v1/recruitment/recruitment.module";
import { PlansModule } from "./modules/v1/plans/plans.module";
import { SubscriptionsModule } from "./modules/v1/subscriptions/subscriptions.module";
import { PayrollModule } from "./modules/v1/payroll/payroll.module";
import { NotificationsModule } from "./modules/v1/notifications/notifications.module";
import { IntegrationModule } from "./common/integrations/integrations.module";
import { LeavePolicyModule } from "./modules/v1/leave-policy/leave-policy.module";
import { TeamsModule } from "./modules/v1/teams/teams.module";
import { WebhooksModule } from "./modules/v1/webhooks/webhooks.module";
import { PaymentMethodModule } from "./modules/v1/payment-method/payment-method.module";

import { ShoutoutsModule } from "./modules/v1/shoutouts/shoutouts.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      ...pinoLoggerConfig,
      forRoutes: ['*'],
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    TenantsModule,
    TenantMembersModule,
    TenantSettingsModule,
    InvitationsModule,
    AddressModule,
    LeaveTypeModule,
    LeaveModule,
    LeaveBalanceModule,
    AssetsModule,
    AssetAssignmentModule,
    AssetMaintenanceModule,
    AssetCategoryModule,
    AssetDocumentModule,
    DepartmentsModule,
    PositionModule,
    EmploymentModule,
    DocumentModule,
    AttendanceModule,
    EmergencyContactModule,
    EducationModule,
    RecruitmentModule,
    PlansModule,
    SubscriptionsModule,
    PayrollModule,
    NotificationsModule,
    IntegrationModule,
    LeavePolicyModule,
    TeamsModule,
    WebhooksModule,
    PaymentMethodModule,

    ShoutoutsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
})
export class AppModule {}
