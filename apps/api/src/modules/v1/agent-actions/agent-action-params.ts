import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { AgentActionName } from '@paqadhr/contracts';
import { PayrollFrequency } from 'src/common/enums/payroll-frequency.enum';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.+-Z]+)?$/;

const PAYROLL_FREQUENCIES = new Set(Object.values(PayrollFrequency));

function rejectParam(field: string, detail: string): never {
  throw new BadRequestException({
    message: `Invalid params.${field}: ${detail}`,
    code: 'AGENT_ACTION_PARAMS_INVALID',
    field,
  });
}

function requireObject(params: Record<string, unknown>): void {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new BadRequestException({
      message: 'params must be an object',
      code: 'AGENT_ACTION_PARAMS_INVALID',
    });
  }
}

function optionalUuid(params: Record<string, unknown>, field: string): void {
  if (params[field] === undefined || params[field] === null) return;
  if (typeof params[field] !== 'string' || !UUID_RE.test(params[field])) {
    rejectParam(field, 'must be a UUID');
  }
}

function requireUuid(params: Record<string, unknown>, field: string): void {
  if (typeof params[field] !== 'string' || !UUID_RE.test(params[field])) {
    rejectParam(field, 'must be a UUID');
  }
}

function requireDate(params: Record<string, unknown>, field: string): void {
  if (typeof params[field] !== 'string' || !DATE_RE.test(params[field])) {
    rejectParam(field, 'must be an ISO date string');
  }
  if (Number.isNaN(Date.parse(params[field]))) {
    rejectParam(field, 'must be a valid date');
  }
}

function optionalString(params: Record<string, unknown>, field: string, maxLen: number): void {
  if (params[field] === undefined || params[field] === null) return;
  if (typeof params[field] !== 'string') {
    rejectParam(field, 'must be a string');
  }
  if (params[field].length > maxLen) {
    rejectParam(field, `must be at most ${maxLen} characters`);
  }
}

function optionalYear(params: Record<string, unknown>): void {
  if (params.year === undefined || params.year === null) return;
  if (typeof params.year !== 'number' || !Number.isInteger(params.year)) {
    rejectParam('year', 'must be an integer');
  }
  if (params.year < 2000 || params.year > 2100) {
    rejectParam('year', 'must be between 2000 and 2100');
  }
}

function assertNoUnknownKeys(params: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(params)) {
    if (!allowed.includes(key)) {
      rejectParam(key, 'is not allowed');
    }
  }
}

function validateEmployeesList(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, []);
}

function validateLeaveBalance(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, ['memberId', 'year']);
  optionalUuid(params, 'memberId');
  optionalYear(params);
}

function validateLeaveRequest(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, ['leaveTypeId', 'startDate', 'endDate', 'reason', 'memberId']);
  requireUuid(params, 'leaveTypeId');
  requireDate(params, 'startDate');
  requireDate(params, 'endDate');
  optionalString(params, 'reason', 2000);
  optionalUuid(params, 'memberId');
}

function validateLeaveDecision(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, ['leaveId', 'comments']);
  requireUuid(params, 'leaveId');
  optionalString(params, 'comments', 2000);
}

function validateApprovalsPending(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, []);
}

function validateShoutoutSend(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, ['message', 'recipients']);
  if (typeof params.message !== 'string' || params.message.trim().length === 0) {
    rejectParam('message', 'must be a non-empty string');
  }
  if (params.message.length > 2000) {
    rejectParam('message', 'must be at most 2000 characters');
  }
  if (!Array.isArray(params.recipients) || params.recipients.length === 0) {
    rejectParam('recipients', 'must be a non-empty array');
  }
  for (const [index, entry] of params.recipients.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      rejectParam(`recipients[${index}]`, 'must be an object');
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.recipientId !== 'string' || !UUID_RE.test(item.recipientId)) {
      rejectParam(`recipients[${index}].recipientId`, 'must be a UUID');
    }
    if (item.points !== undefined && item.points !== null) {
      if (typeof item.points !== 'number' || !Number.isInteger(item.points) || item.points < 1) {
        rejectParam(`recipients[${index}].points`, 'must be a positive integer');
      }
    }
  }
}

function validatePayrollRunStatus(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, ['runId']);
  requireUuid(params, 'runId');
}

function validatePayrollRunCreate(params: Record<string, unknown>): void {
  assertNoUnknownKeys(params, [
    'title',
    'frequency',
    'periodStart',
    'periodEnd',
    'paymentDate',
    'baseCurrency',
    'employeeIds',
  ]);
  if (typeof params.title !== 'string' || params.title.trim().length === 0) {
    rejectParam('title', 'must be a non-empty string');
  }
  if (params.title.length > 200) {
    rejectParam('title', 'must be at most 200 characters');
  }
  if (
    typeof params.frequency !== 'string' ||
    !PAYROLL_FREQUENCIES.has(params.frequency as PayrollFrequency)
  ) {
    rejectParam('frequency', 'must be a valid payroll frequency');
  }
  requireDate(params, 'periodStart');
  requireDate(params, 'periodEnd');
  requireDate(params, 'paymentDate');
  if (params.baseCurrency !== undefined && params.baseCurrency !== null) {
    if (typeof params.baseCurrency !== 'string' || !/^[A-Z]{3}$/.test(params.baseCurrency)) {
      rejectParam('baseCurrency', 'must be a 3-letter currency code');
    }
  }
  if (params.employeeIds !== undefined && params.employeeIds !== null) {
    if (!Array.isArray(params.employeeIds)) {
      rejectParam('employeeIds', 'must be an array of UUIDs');
    }
    for (const [index, id] of params.employeeIds.entries()) {
      if (typeof id !== 'string' || !UUID_RE.test(id)) {
        rejectParam(`employeeIds[${index}]`, 'must be a UUID');
      }
    }
  }
}

const VALIDATORS: Record<AgentActionName, (params: Record<string, unknown>) => void> = {
  'employees.list': validateEmployeesList,
  'leave.balance': validateLeaveBalance,
  'leave.request': validateLeaveRequest,
  'leave.approve': validateLeaveDecision,
  'leave.reject': validateLeaveDecision,
  'approvals.pending': validateApprovalsPending,
  'shoutout.send': validateShoutoutSend,
  'payroll.run.status': validatePayrollRunStatus,
  'payroll.run.create': validatePayrollRunCreate,
};

/** Validate agent action params at the gateway boundary. Rejects unknown fields. */
export function validateAgentActionParams(
  action: AgentActionName,
  params: Record<string, unknown>,
): void {
  requireObject(params);
  VALIDATORS[action](params);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

/** SHA-256 of stably serialized params for idempotency conflict detection. */
export function hashAgentActionParams(params: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(params)).digest('hex');
}
