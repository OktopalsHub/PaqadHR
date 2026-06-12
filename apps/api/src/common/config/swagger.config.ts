import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication): void {
	const config = new DocumentBuilder()
		.setTitle("PaqadHR API")
		.setDescription(
			`
      # PaqadHR API Documentation
      A comprehensive HR management platform API that provides:
      ## Features
      - **Multi-tenant Architecture**: Secure tenant isolation
      - **Authentication & Authorization**: JWT-based auth with role-based access
      - **Employee Management**: Complete employee lifecycle management
      - **Attendance Tracking**: Clock in/out with geolocation support
      - **Leave Management**: Leave requests, approvals, and balance tracking
      - **Payroll Processing**: Automated payroll calculations and payments
      - **Asset Management**: Company asset tracking and assignment
      - **Recruitment**: Job postings, applications, and interview scheduling
      - **Shoutouts & Recognition**: Peer recognition with points and core values
      - **Integrations**: Slack, Discord, and other platform integrations
      ## Authentication
      Most endpoints require authentication via JWT token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      ## Multi-tenancy
      All tenant-specific endpoints require a tenant context, provided via:
      - Subdomain: \`https://your-tenant.paqadhr.com\`
      - Path parameter: \`/api/v1/tenants/{tenantId}/...\`
      - Query parameter: \`?tenant=your-tenant-slug\`
      ## Rate Limiting
      API endpoints are rate-limited to ensure fair usage:
      - General endpoints: 100 requests per 15 minutes
      - Authentication endpoints: 5 attempts per 15 minutes
      - API endpoints: 1000 requests per hour
      ## Error Handling
      All errors follow a consistent format:
      \`\`\`json
      {
        "statusCode": 400,
        "error": "Bad Request",
        "message": "Validation failed",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "path": "/api/v1/endpoint",
        "traceId": "trace-id-for-debugging"
      }
      \`\`\`
    `,
		)
		.setVersion("1.0")
		.setContact(
			"PaqadHR Support",
			"https://paqadhr.com/support",
			"support@paqadhr.com",
		)
		.setLicense("MIT", "https://opensource.org/licenses/MIT")
		.addServer("http://localhost:8001", "Development Server")
		.addServer("https://api.paqadhr.com", "Production Server")
		.addBearerAuth(
			{
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				name: "JWT",
				description: "Enter JWT token",
				in: "header",
			},
			"JWT-auth",
		)
		.addApiKey(
			{
				type: "apiKey",
				name: "X-API-Key",
				in: "header",
				description: "API Key for service-to-service communication",
			},
			"API-Key",
		)
		.addTag("Authentication", "User authentication and authorization")
		.addTag("Tenants", "Multi-tenant organization management")
		.addTag("Users", "User account management")
		.addTag("Employees", "Employee management and profiles")
		.addTag("Attendance", "Time tracking and attendance management")
		.addTag("Leave Management", "Leave requests and balance tracking")
		.addTag("Payroll", "Payroll processing and calculations")
		.addTag("Assets", "Company asset management")
		.addTag("Recruitment", "Job postings and candidate management")
		.addTag("Shoutouts", "Employee recognition and rewards")
		.addTag("Integrations", "Third-party platform integrations")
		.build();

	const document = SwaggerModule.createDocument(app, config, {
		operationIdFactory: (_controllerKey: string, methodKey: string) =>
			methodKey,
		deepScanRoutes: true,
	});

	document.info["x-logo"] = {
		url: "https://paqadhr.com/logo.png",
		altText: "PaqadHR Logo",
	};

	SwaggerModule.setup("api/docs", app, document, {
		swaggerOptions: {
			persistAuthorization: true,
			displayRequestDuration: true,
			docExpansion: "none",
			filter: true,
			showRequestHeaders: true,
			tryItOutEnabled: true,
		},
		customSiteTitle: "PaqadHR API",
		customfavIcon: "https://paqadhr.com/favicon.ico",
		customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    `,
	});
}
