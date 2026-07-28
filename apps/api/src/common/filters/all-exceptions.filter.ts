import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorResponseService } from '../services/error-response.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly errorResponseService: ErrorResponseService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const path = request.url;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        message = (obj.message as string | string[]) ?? exception.message;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    const errorResponse = this.errorResponseService.createErrorResponse(
      status,
      HttpStatus[status] ?? 'Error',
      message,
      path,
    );

    response.status(status).json(errorResponse);
  }
}
