import type { HttpStatus } from '@nestjs/common';
import type { ErrorContext } from '../interfaces/error-context.interface';

const GENERIC_MESSAGES: Partial<Record<HttpStatus, string>> = {
  400: 'Invalid request. Please check your input and try again.',
  401: 'Authentication required. Please log in and try again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  405: 'This method is not allowed for this resource.',
  409: 'A conflict occurred. Please try again.',
  422: 'The request could not be processed. Please check your input.',
  429: 'Too many requests. Please try again later.',
};

const SERVER_MESSAGES: Partial<Record<HttpStatus, string>> = {
  500: 'An internal server error occurred. Please try again later.',
  502: 'Service temporarily unavailable. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
  504: 'Request timeout. Please try again later.',
  501: 'This feature is not available.',
};

const SENSITIVE_PATTERNS = [
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

export function getGenericClientErrorMessage(status: HttpStatus): string {
  return GENERIC_MESSAGES[status] || 'An error occurred. Please try again.';
}

export function getServerErrorMessage(status: HttpStatus): string {
  return SERVER_MESSAGES[status] || 'An internal server error occurred. Please try again later.';
}

export function sanitizeString(message: string): string {
  if (typeof message !== 'string') return message;
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function sanitizeMessage(message: string | string[], status: HttpStatus): string | string[] {
  const sanitized = Array.isArray(message)
    ? message.map((m) => sanitizeString(m))
    : sanitizeString(message);

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    return sanitized;
  }
  if (status >= 400 && status < 500) {
    return process.env.NODE_ENV === 'production' ? getGenericClientErrorMessage(status) : sanitized;
  }
  if (status >= 500) {
    return getServerErrorMessage(status);
  }
  return sanitized;
}

export function sanitizeContext(
  context: ErrorContext | Record<string, unknown>,
  status: HttpStatus,
): Record<string, unknown> {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    return { ...context, timestamp: new Date().toISOString() };
  }
  if (process.env.NODE_ENV === 'production' && status >= 500) {
    return { timestamp: new Date().toISOString() };
  }
  return { ...context, timestamp: new Date().toISOString() };
}

export function shouldIncludeContext(status: HttpStatus): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    return true;
  }
  return process.env.NODE_ENV === 'production' && status < 500;
}

export function isServerError(status: HttpStatus): boolean {
  return status >= 500;
}

export function shouldIncludeDetails(status: HttpStatus): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    return true;
  }
  return process.env.NODE_ENV === 'production' && status < 500;
}

export function getLogLevel(status: HttpStatus): 'error' | 'warn' | 'log' {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'log';
}

export function formatValidationErrors(
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

export function formatValidationMessages(messages: string[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  messages.forEach((msg) => {
    const enhancedMatch = msg.match(/^([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*): (.+)$/);
    if (enhancedMatch) {
      const field = enhancedMatch[1];
      const constraint = enhancedMatch[2];
      if (!errors[field]) errors[field] = [];
      errors[field].push(constraint);
      return;
    }
    const classValidatorMatch = msg.match(/^(\w+)\s+(.+)$/);
    if (classValidatorMatch) {
      const field = classValidatorMatch[1];
      const constraint = classValidatorMatch[2];
      if (!errors[field]) errors[field] = [];
      errors[field].push(constraint);
      return;
    }
    const patterns = [
      /^([A-Z][a-zA-Z\s]*)\s+(must\s+.+|should\s+.+|cannot\s+.+|is\s+.+)/i,
      /^(\w+)\s+(must\s+.+|should\s+.+|cannot\s+.+|is\s+.+)/i,
      /^(\w+)\s+(should not be empty|is required|cannot be empty)/i,
      /^(\w+)\s+(must be at least|must contain|must have)/i,
    ];
    for (const pattern of patterns) {
      const match = msg.match(pattern);
      if (match) {
        const field = match[1].toLowerCase().replace(/\s+/g, '');
        if (!errors[field]) errors[field] = [];
        errors[field].push(match[2]);
        return;
      }
    }
    const fieldMatch = msg.match(/^(\w+)/);
    if (fieldMatch && fieldMatch[1].length > 1) {
      const field = fieldMatch[1];
      if (!errors[field]) errors[field] = [];
      errors[field].push(msg);
    } else {
      if (!errors.general) errors.general = [];
      errors.general.push(msg);
    }
  });
  return errors;
}
