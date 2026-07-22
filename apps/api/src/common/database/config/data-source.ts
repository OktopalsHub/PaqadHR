import * as dotenv from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as Entities from '../entities';
import * as Migrations from '../migrations';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined, please check your environment variables.');
}

const AppDataSource = {
  type: 'postgres',
  url: databaseUrl,
  synchronize: false,
  autoLoadEntities: true,
  entities: Object.values(Entities).filter((entity) => typeof entity === 'function'),
  migrations: [
    Migrations.User1781241191518,
    Migrations.Verification1781241195145,
    Migrations.Account1781241198793,
    Migrations.Session1781241202635,
    Migrations.Plans1781241205375,
    Migrations.Tenants1781241207756,
    Migrations.PlanPrices1781241209906,
    Migrations.TenantMembers1781241212614,
    Migrations.TenantSettings1781241214653,
    Migrations.TenantCounters1781241216981,
    Migrations.TenantSubscriptions1781241219116,
    Migrations.Position1781241221789,
    Migrations.Departments1781241226267,
    Migrations.DepartmentMembers1781241229102,
    Migrations.TenantMemberPositions1781241231969,
    Migrations.Teams1781241236122,
    Migrations.TeamMembers1781241239188,
    Migrations.Address1781241241536,
    Migrations.LeaveTypes1781241244501,
    Migrations.LeavePolicies1781241247961,
    Migrations.LeaveBalances1781241250959,
    Migrations.Leaves1781241253739,
    Migrations.AttendancePolicies1781241256339,
    Migrations.Attendances1781241259357,
    Migrations.AttendanceExceptions1781241262038,
    Migrations.Employment1781241265242,
    Migrations.Education1781241268760,
    Migrations.EmergencyContact1781241272764,
    Migrations.Document1781241275774,
    Migrations.Invitations1781241292545,
    Migrations.PaymentMethods1781241295211,
    Migrations.PaymentSecurity1781241297732,
    Migrations.JobOpening1781241300448,
    Migrations.Candidate1781241303161,
    Migrations.Assessment1781241305935,
    Migrations.CandidateAssessment1781241308420,
    Migrations.CandidateNote1781241310923,
    Migrations.Interview1781241313906,
    Migrations.ShoutoutCategories1781241316869,
    Migrations.Shoutouts1781241320434,
    Migrations.ShoutoutRecipients1781241323004,
    Migrations.ShoutoutCategoryAssignments1781241325513,
    Migrations.ShoutoutMemberPoints1781241328785,
    Migrations.ShoutoutPointTransactions1781241332199,
    Migrations.PlatformIntegrations1781241334797,
    Migrations.IntegrationChannels1781241337624,
    Migrations.PlatformUsers1781241340372,
    Migrations.UserIntegrationTokens1781241343356,
    Migrations.PayrollRuns1781241346483,
    Migrations.PayrollItems1781241349201,
    Migrations.PayrollAuditLogs1781241351647,
    Migrations.PaymentMethodPasscodeHistory1781241354210,
    Migrations.NotificationPreferences1781241357044,
    Migrations.Notifications1781241359849,
    Migrations.AuditLogs1781241362361,
    Migrations.BillingEvents1781549462127,
    Migrations.TenantCalendarEvents1781549462128,
    Migrations.CalendarEventTimeReminder1781549462129,
    Migrations.CalendarEventReminderSent1781549462130,
    Migrations.EmploymentPositionNullable1781549462131,
    Migrations.CandidateCustomAnswers1781549462132,
    Migrations.AddColorToDepartment1781550110123,
    Migrations.AddColorToPosition1781550110124,
    Migrations.RewardsSetup1782000000000,
    Migrations.TasksSetup1782500000000,
    Migrations.AutoTopupAndRecurringTasks1782838353633,
    Migrations.TenantWalletVirtualAccounts1782913542028,
    Migrations.SubscriptionDunningAndLifecycle1782914289290,
    Migrations.WalletTransactionReferenceScope1782921523406,
    Migrations.DropAssetManagement1783110763106,
    Migrations.DropPayrollAuditLogsCreateTenantActivities1783160913090,
    Migrations.InvitationNamesNullable1783258356100,
    Migrations.TenantSubscriptionBillingProvider1783369099246,
    Migrations.TenantSubscriptionExternalSubscription1784546774315,
    Migrations.PlanPriceExternalProductIds1784548594725,
    Migrations.PayrollPayoutModeAndEmploymentCurrency1784756934802,
  ],
  logging: process.env.NODE_ENV === 'production' ? false : ['error', 'warn'],
  migrationsRun: true,
  migrationsTransactionMode: 'all',
  namingStrategy: new SnakeNamingStrategy(),
} as DataSourceOptions;

export const dataSourceOptions = AppDataSource;
export default new DataSource(AppDataSource);

export async function waitForDatabase(maxRetries = 30, retryIntervalMs = 1000): Promise<void> {
  const { Client } = await import('pg');

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      await client.end();
      return;
    } catch (error: unknown) {
      if (i === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }
}
