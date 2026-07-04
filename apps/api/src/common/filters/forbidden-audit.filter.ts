import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ForbiddenException,
} from '@nestjs/common';
import { AuditLogsService } from '../../modules/v1/audit-logs/services/audit-logs.service';
import { AuditAction, AuditSeverity, AuditStatus } from '../enums/audit-action.enum';
import type { IAuthenticatedMemberRequest } from '../interfaces';

@Catch(ForbiddenException)
export class ForbiddenAuditFilter implements ExceptionFilter {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  catch(exception: ForbiddenException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<IAuthenticatedMemberRequest>();
    const response = ctx.getResponse();

    const tenantId = (request.params?.tenantId as string | undefined) ?? request.tenant?.id ?? null;
    const memberId = request.member?.id ?? null;
    const userId = request.member?.userId ?? null;

    void this.auditLogsService.queueAuditLog({
      action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      description: exception.message,
      severity: AuditSeverity.MEDIUM,
      status: AuditStatus.FAILED,
      tenantId,
      userId,
      ipAddress: request.ip ?? null,
      userAgent: request.get?.('User-Agent') ?? null,
      metadata: {
        method: request.method,
        path: request.url,
        memberId,
      },
    });

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    response
      .status(status)
      .json(
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse }
          : exceptionResponse,
      );
  }
}
