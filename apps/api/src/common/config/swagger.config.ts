import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('PaqadHR API')
    .setDescription('PaqadHR REST API — browse endpoints by tag below.')
    .setVersion('1.0')
    .addServer('http://localhost:9001', 'Development Server')
    .addServer('https://api.paqadhr.com', 'Production Server')
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
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for service-to-service communication',
      },
      'API-Key',
    )
    .addTag('Analytics', 'Workforce insights and reporting')
    .addTag(
      'Authentication',
      'JWT auth via Authorization: Bearer token. Login, register, and session endpoints.',
    )
    .addTag(
      'Tenants',
      'Multi-tenant organizations. Tenant context via path /api/v1/tenants/{tenantId}/... or x-tenant-id header.',
    )
    .addTag('Users', 'User account management, profile, and data export')
    .addTag('Employees', 'Employee management and profiles')
    .addTag('Attendance', 'Time tracking and attendance management')
    .addTag('Leave Management', 'Leave requests and balance tracking')
    .addTag('Payroll', 'Payroll processing, disbursement, and calculations')
    .addTag('Assets', 'Company asset management')
    .addTag('Recruitment', 'Job postings and candidate management')
    .addTag('Shoutouts', 'Employee recognition, points, and Slack broadcast')
    .addTag('Integrations', 'Slack OAuth, channel setup, and platform webhooks')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });

  document.info['x-logo'] = {
    url: 'https://paqadhr.com/logo.png',
    altText: 'PaqadHR Logo',
  };

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'PaqadHR API',
    customfavIcon: 'https://paqadhr.com/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    `,
  });
}
