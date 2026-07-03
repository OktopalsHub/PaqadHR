import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { ErrorContext } from '../interfaces/error-context.interface';
import type { StandardErrorResponse } from '../interfaces/standard-error-response.interface';

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
      message: this.sanitizeMessage(message, status),
      timestamp: new Date().toISOString(),
      path,
      traceId: traceId || randomUUID(),
    };
    if (errors && Object.keys(errors).length > 0) {
      response.errors = errors;
    }
    if (code) {
      response.code = code;
    }
    if (context && this.shouldIncludeContext(status)) {
      response.context = this.sanitizeContext(context, status);
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
    message: string = 'Authentication required',
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
    message: string = 'Insufficient permissions',
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
    resource: string = 'Resource',
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
    message: string = 'Resource conflict',
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
    message: string = 'Service temporarily unavailable',
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
    message: string = 'Request timeout',
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
    message: string = 'Too many requests',
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
    const errors: Record<string, string[]> = {};
    validationErrors.forEach((error) => {
      if (error.property && error.constraints) {
        errors[error.property] = Object.values(error.constraints);
      }
    });
    return errors;
  }
  formatValidationMessages(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    messages.forEach((msg) => {
      const enhancedMatch = msg.match(/^([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*): (.+)$/);
      if (enhancedMatch) {
        const field = enhancedMatch[1];
        const constraint = enhancedMatch[2];
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(constraint);
        return;
      }
      const classValidatorMatch = msg.match(/^(\w+)\s+(.+)$/);
      if (classValidatorMatch) {
        const field = classValidatorMatch[1];
        const constraint = classValidatorMatch[2];
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(constraint);
        return;
      }
      const patterns = [
        /^([A-Z][a-zA-Z\s]*)\s+(must\s+.+|should\s+.+|cannot\s+.+|is\s+.+)/i,
        /^(\w+)\s+(must\s+.+|should\s+.+|cannot\s+.+|is\s+.+)/i,
        /^(\w+)\s+(should not be empty|is required|cannot be empty)/i,
        /^(\w+)\s+(must be at least|must contain|must have)/i,
      ];
      let matched = false;
      for (const pattern of patterns) {
        const match = msg.match(pattern);
        if (match) {
          const field = match[1].toLowerCase().replace(/\s+/g, '');
          const constraint = match[2];
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(constraint);
          matched = true;
          break;
        }
      }
      if (!matched) {
        const fieldMatch = msg.match(/^(\w+)/);
        if (fieldMatch && fieldMatch[1].length > 1) {
          const field = fieldMatch[1];
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(msg);
        } else {
          if (!errors.general) {
            errors.general = [];
          }
          errors.general.push(msg);
        }
      }
    });
    return errors;
  }
  private sanitizeMessage(message: string | string[], status: HttpStatus): string | string[] {
    const sanitizedMessage = this.removeSensitiveInfo(message);
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
      return sanitizedMessage;
    }
    if (status >= 400 && status < 500) {
      if (process.env.NODE_ENV === 'production') {
        return this.getGenericClientErrorMessage(status);
      }
      return sanitizedMessage;
    }
    if (status >= 500) {
      const sanitizedMessages = {
        [HttpStatus.INTERNAL_SERVER_ERROR]:
          'An internal server error occurred. Please try again later.',
        [HttpStatus.BAD_GATEWAY]: 'Service temporarily unavailable. Please try again later.',
        [HttpStatus.SERVICE_UNAVAILABLE]:
          'Service temporarily unavailable. Please try again later.',
        [HttpStatus.GATEWAY_TIMEOUT]: 'Request timeout. Please try again later.',
        [HttpStatus.NOT_IMPLEMENTED]: 'This feature is not available.',
      };
      return (
        sanitizedMessages[status] || 'An internal server error occurred. Please try again later.'
      );
    }
    return sanitizedMessage;
  }
  private removeSensitiveInfo(message: string | string[]): string | string[] {
    if (Array.isArray(message)) {
      return message.map((msg) => this.sanitizeString(msg));
    }
    return this.sanitizeString(message);
  }
  private sanitizeString(message: string): string {
    if (typeof message !== 'string') return message;
    const sensitivePatterns = [
      /postgres:\/\/[^@]+@[^/]+\/\w+/gi,
      /mysql:\/\/[^@]+@[^/]+\/\w+/gi,
      /mongodb:\/\/[^@]+@[^/]+\/\w+/gi,
      /\b(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)\d{1,3}\.\d{1,3}\b/g,
      /at\s+[^\s]+\s+\([^)]+\)/g,
      /^\s*at\s+.*$/gm,
      /column\s+"[^"]+"/gi,
      /table\s+"[^"]+"/gi,
      /relation\s+"[^"]+"/gi,
    ];
    let sanitized = message;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  }
  private getGenericClientErrorMessage(status: HttpStatus): string {
    const genericMessages = {
      [HttpStatus.BAD_REQUEST]: 'Invalid request. Please check your input and try again.',
      [HttpStatus.UNAUTHORIZED]: 'Authentication required. Please log in and try again.',
      [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action.',
      [HttpStatus.NOT_FOUND]: 'The requested resource was not found.',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'This method is not allowed for this resource.',
      [HttpStatus.CONFLICT]: 'A conflict occurred. Please try again.',
      [HttpStatus.UNPROCESSABLE_ENTITY]:
        'The request could not be processed. Please check your input.',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
    };
    return genericMessages[status] || 'An error occurred. Please try again.';
  }
  private sanitizeContext(context: ErrorContext, status: HttpStatus): Record<string, unknown> {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
      return {
        ...context,
        timestamp: new Date().toISOString(),
      };
    }
    if (process.env.NODE_ENV === 'production' && status >= 500) {
      return {
        timestamp: new Date().toISOString(),
      };
    }
    return {
      ...context,
      timestamp: new Date().toISOString(),
    };
  }
  private shouldIncludeContext(status: HttpStatus): boolean {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
      return true;
    }
    return process.env.NODE_ENV === 'production' && status < 500;
  }
  isServerError(status: HttpStatus): boolean {
    return status >= 500;
  }
  shouldIncludeDetails(status: HttpStatus): boolean {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
      return true;
    }
    return process.env.NODE_ENV === 'production' && status < 500;
  }
  getLogLevel(status: HttpStatus): 'error' | 'warn' | 'log' {
    if (status >= 500) return 'error';
    if (status >= 400) return 'warn';
    return 'log';
  }
}
