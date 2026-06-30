import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('PaqadHR API')
    .setDescription(
      'Welcome to the **PaqadHR**. \n\n' +
        'PaqadHR is a multi-tenant Human Resource Management platform. All tenant-scoped endpoints follow the pattern ' +
        '`/api/v1/tenants/{tenantId}/...`. Authentication uses JWT Bearer tokens — obtain one via `POST /api/v1/auth/login`. \n\n' +
        'Tags are organized by feature area. Use the filter box above to search endpoints.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:9001', 'Local Server')
    .addServer('https://paqad.dev.oktopals.com', 'Dev Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag(
      'Tenant Onboarding',
      'Workspace registration, domain check, and localized pricing setup.',
    )
    .addTag('Tenants', 'Workspace organization context and active tenant metadata.')
    .addTag(
      'Tenant Settings',
      'Workspace configuration variables, global settings, and preferences.',
    )
    .addTag(
      'Authentication',
      'JWT session management, credentials validation, password recovery, and OAuth flows.',
    )
    .addTag('Users', 'Base user account management, global profile details, and data export tools.')
    .addTag('Tenant Members', 'Workspace member directory, roles, and status controls.')
    .addTag('Public Tenant Members', 'Public workspace profiles accessible before authentication.')
    .addTag('Invitations', 'Workspace team invite dispatches, logs, and cancellation actions.')
    .addTag('Public Invitations', 'Pre-auth verification endpoints for workspace invitations.')
    .addTag('Employments', 'Employee contract histories, dates, and employment statuses.')
    .addTag('Addresses', 'Employee home addresses and spatial configurations.')
    .addTag('Education', 'Employee academic degrees, credentials, and achievements.')
    .addTag('Emergency Contacts', 'Employee emergency profiles and family contact cards.')
    .addTag('Documents', 'Private employee identity cards, forms, and secure document vaults.')
    .addTag('Files', 'S3/R2 presigned upload URL generators and storage utilities.')
    .addTag('Departments', 'Organizational departments, budget assignments, and leaders.')
    .addTag('Positions', 'Job positions, levels, role definitions, and salary bands.')
    .addTag('Teams', 'Workspace cross-functional teams and team spaces.')
    .addTag('Calendar Events', 'Unified holiday dates, company calendars, and events.')
    .addTag('Attendance', 'Time tracking, shift templates, geofenced clock logs, and timesheets.')
    .addTag('Leaves', 'Time-off requests, validation, balance deductions, and manager approvals.')
    .addTag('Leave Balances', 'Accrued annual vacation limits, real-time balances, and logs.')
    .addTag('Leave Types', 'Organization custom leave policies (sick, casual, maternal, etc.).')
    .addTag('Payroll', 'Payrun calculation runs, adjustments, approvals, and manual disbursements.')
    .addTag(
      'Payroll Fees',
      'Platform fee breakdowns, transaction taxes, and calculated preview totals.',
    )
    .addTag('Payment Methods', 'Workspace payout bank configurations and verification passcodes.')
    .addTag('Nomba Utilities', 'Nomba API checkout status and developer tools.')
    .addTag('Job Openings', 'Recruitment jobs list, hiring boards, and open position settings.')
    .addTag('Tenant Candidates', 'Job applicant records, ratings, and screening pipeline.')
    .addTag('Interviews', 'Recruitment interview scheduling, panel groups, and feedback cards.')
    .addTag('Public Jobs', 'External public jobs listing accessible for candidate applications.')
    .addTag('Public Applications', 'Public external candidate job application forms.')
    .addTag(
      'Shoutouts',
      'Workspace social appreciation posts, points awards, and Slack broadcast logs.',
    )
    .addTag('Rewards', 'Point-based employee gift card redemptions and prepaid wallets.')
    .addTag('Plans', 'Global pricing structures, plan definitions, and base costs.')
    .addTag('Plans Admin', 'Platform admin controls for defining subscription options.')
    .addTag(
      'Subscriptions',
      'Workspace payment status, Stripe/Nomba package configurations, and invoices.',
    )
    .addTag(
      'Subscriptions Admin',
      'Platform admin controls for monitoring tenant subscription states.',
    )
    .addTag(
      'Notification Preferences',
      'Custom email/push configurations for workspace notifications.',
    )
    .addTag('Notifications', 'In-app and email notifications inbox and logs.')
    .addTag('Analytics', 'Workforce headcount metrics, demographics, and turn-over visual reports.')
    .addTag(
      'Assets',
      'Company physical inventory, assignments, documents, and maintenance tracking.',
    )
    .addTag('Integrations', 'Workspace platform links (Slack, etc.) and OAuth bindings.')
    .addTag(
      'Integration Management',
      'Workspace integration synchronization and member mapping tools.',
    )
    .addTag('Slack Webhooks', 'Receiving inbound event payloads from Slack workspace apps.')
    .addTag('Payment Webhooks', 'Receiving payment transaction notification events.')
    .addTag('Payroll Webhooks', 'Receiving payout status notification updates.')
    .addTag('Subscription Webhooks', 'Receiving subscription update webhook events.')
    .addTag('App', 'Core application health check routes and general server info.')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'PaqadHR API',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1a1a2e; font-weight: 700; }
      .swagger-ui .info .description p { color: #444; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 8px; }
      .swagger-ui .opblock-tag { font-size: 15px; font-weight: 600; }
    `,
  });
}
