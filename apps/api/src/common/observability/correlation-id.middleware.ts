import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nestjs';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';
import { correlationIdStorage } from './correlation-id.storage';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const correlationId =
    typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  Sentry.getCurrentScope().setTag('correlation_id', correlationId);

  correlationIdStorage.run({ correlationId }, () => next());
}
