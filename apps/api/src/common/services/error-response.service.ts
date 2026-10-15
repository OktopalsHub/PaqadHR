import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { ErrorContext } from '../interfaces/error-context.interface';
import type { StandardErrorResponse } from '../interfaces/standard-error-response.interface';
import {
  formatValidationErrors,
  formatValidationMessages,
  getLogLevel,
  isServerError,
  sanitizeContext,
  sanitizeMessage,
  shouldIncludeContext,
  shouldIncludeDetails,
} from './error-mapping.service';

@Injectable()
export class ErrorResponseService {
  createErrorResponse(
    status: HttpStatus,
    error: string,
    message: string | string[],
    path: string,
    traceId?: string,
    errors?: Record<string, string[]>,
    code?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    const response: StandardErrorResponse = {
      statusCode: status,
      error,
      message: sanitizeMessage(message, status),
      timestamp: new Date().toISOString(),
      path,
      traceId: traceId || randomUUID(),
    };
    if (errors && Object.keys(errors).length > 0) response.errors = errors;
    if (code) response.code = code;
    if (context && shouldIncludeContext(status)) {
      response.context = sanitizeContext(context, status);
    }
    return response;
  }

  createBadRequestResponse(
    message: string | string[],
    path: string,
    validationErrors?: Record<string, string[]>,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.BAD_REQUEST,
      'Bad Request',
      message,
      path,
      traceId,
      validationErrors,
      undefined,
      context,
    );
  }

  createUnauthorizedResponse(
    message = 'Authentication required',
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.UNAUTHORIZED,
      'Unauthorized',
      message,
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  createForbiddenResponse(
    message = 'Insufficient permissions',
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.FORBIDDEN,
      'Forbidden',
      message,
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  createNotFoundResponse(
    resource = 'Resource',
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.NOT_FOUND,
      'Not Found',
      `${resource} not found`,
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  createConflictResponse(
    message = 'Resource conflict',
    path: string,
    traceId?: string,
    errors?: Record<string, string[]>,
    code?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.CONFLICT,
      'Conflict',
      message,
      path,
      traceId,
      errors,
      code,
      context,
    );
  }

  createInternalServerErrorResponse(
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal Server Error',
      'An unexpected error occurred',
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  createServiceUnavailableResponse(
    message = 'Service temporarily unavailable',
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.SERVICE_UNAVAILABLE,
      'Service Unavailable',
      message,
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  createGatewayTimeoutResponse(
    message = 'Request timeout',
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.GATEWAY_TIMEOUT,
      'Gateway Timeout',
      message,
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  createRateLimitResponse(
    message = 'Too many requests',
    path: string,
    traceId?: string,
    context?: ErrorContext,
  ): StandardErrorResponse {
    return this.createErrorResponse(
      HttpStatus.TOO_MANY_REQUESTS,
      'Too Many Requests',
      message,
      path,
      traceId,
      undefined,
      undefined,
      context,
    );
  }

  formatValidationErrors(
    validationErrors: Array<{
      property?: string;
      constraints?: Record<string, string>;
    }>,
  ): Record<string, string[]> {
    return formatValidationErrors(validationErrors);
  }

  formatValidationMessages(messages: string[]): Record<string, string[]> {
    return formatValidationMessages(messages);
  }

  isServerError(status: HttpStatus): boolean {
    return isServerError(status);
  }

  shouldIncludeDetails(status: HttpStatus): boolean {
    return shouldIncludeDetails(status);
  }

  getLogLevel(status: HttpStatus): 'error' | 'warn' | 'log' {
    return getLogLevel(status);
  }
}
