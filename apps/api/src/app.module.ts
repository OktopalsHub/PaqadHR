import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { dataSourceOptions } from './common/config';
import { JwtAuthGuard } from './common/guards';
import { TenantGuard } from './common/guards/tenant.guard';
import { IntegrationModule } from './common/integrations/integrations.module';
import { AuditModule } from './common/modules/audit.module';
import { ForbiddenAuditFilter } from './common/filters/forbidden-audit.filter';
import { AuditLogsService } from './common/services/audit-logs.service';
import { ManagerAccessModule } from './common/modules/manager-access.module';
import { EncryptionModule } from './common/modules/encryption.module';
import { RateLimitModule } from './common/modules/rate-limit.module';
import { AddressModule } from './modules/v1/address/address.module';
import { AnalyticsModule } from './modules/v1/analytics/analytics.module';
import { AssetsModule } from './modules/v1/assets/assets.module';
import { AssetAssignmentModule } from './modules/v1/assets/assignment/asset-assignment.module';
import { AssetCategoryModule } from './modules/v1/assets/category/asset-category.module';
import { AssetDocumentModule } from './modules/v1/assets/document/asset-document.module';
import { AssetMaintenanceModule } from './modules/v1/assets/maintenance/asset-maintenance.module';
import { AttendanceModule } from './modules/v1/attendance/attendance.module';
import { CalendarEventsModule } from './modules/v1/calendar-events/calendar-events.module';
import { AuthModule } from './modules/v1/auth/auth.module';
import { DepartmentsModule } from './modules/v1/departments/departments.module';
import { DocumentModule } from './modules/v1/document/document.module';
import { EducationModule } from './modules/v1/education/education.module';
import { EmergencyContactModule } from './modules/v1/emergency-contact/emergency-contact.module';
import { EmploymentModule } from './modules/v1/employment/employment.module';
import { InvitationsModule } from './modules/v1/invitations/invitations.module';
import { LeaveModule } from './modules/v1/leave/leave.module';
import { LeaveManagementModule } from './modules/v1/leave/listeners/leave-management.module';
import { LeaveBalanceModule } from './modules/v1/leave-balance/leave-balance.module';
import { LeavePolicyModule } from './modules/v1/leave-policy/leave-policy.module';
import { LeaveTypeModule } from './modules/v1/leave-type/leave-type.module';
import { NotificationsModule } from './modules/v1/notifications/notifications.module';
import { PaymentMethodModule } from './modules/v1/payment-method/payment-method.module';
import { PayrollModule } from './modules/v1/payroll/payroll.module';
import { PlansModule } from './modules/v1/plans/plans.module';
import { PositionModule } from './modules/v1/position/position.module';
import { RecruitmentModule } from './modules/v1/recruitment/recruitment.module';
import { ShoutoutsModule } from './modules/v1/shoutouts/shoutouts.module';
import { SubscriptionsModule } from './modules/v1/subscriptions/subscriptions.module';
import { TeamsModule } from './modules/v1/teams/teams.module';
import { TenantMembersModule } from './modules/v1/tenant-members/tenant-members.module';
import { TenantSettingsModule } from './modules/v1/tenant-settings/tenant-settings.module';
import { TenantsModule } from './modules/v1/tenants/tenants.module';
import { UsersModule } from './modules/v1/users/users.module';
import { WebhooksModule } from './modules/v1/webhooks/webhooks.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    TypeOrmModule.forRoot(dataSourceOptions),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    EncryptionModule,
    RateLimitModule,
    AuditModule,
    ManagerAccessModule,
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
    LeaveManagementModule,
    TeamsModule,
    WebhooksModule,
    PaymentMethodModule,
    ShoutoutsModule,
    AnalyticsModule,
    CalendarEventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_FILTER,
      useFactory: (auditLogsService: AuditLogsService) =>
        new ForbiddenAuditFilter(auditLogsService),
      inject: [AuditLogsService],
    },
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
