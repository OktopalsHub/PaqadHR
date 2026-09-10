#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callAgentAction } from './client.js';

const server = new McpServer({
  name: 'paqadhr',
  version: '0.1.0',
});

server.tool('list_employees', 'List active employees in the workspace', {}, async () => {
  const result = await callAgentAction('employees.list', {});
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  'get_leave_balance',
  'Get leave balances for a member',
  { memberId: z.string().uuid().optional(), year: z.number().int().optional() },
  async ({ memberId, year }) => {
    const result = await callAgentAction('leave.balance', { memberId, year });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'request_leave',
  'Submit a leave request',
  {
    leaveTypeId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().optional(),
    memberId: z.string().uuid().optional(),
  },
  async (params) => {
    const result = await callAgentAction('leave.request', params, randomIdempotencyKey());
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'approve_leave',
  'Approve a pending leave request (may require admin approval in queue)',
  { leaveId: z.string().uuid(), comments: z.string().optional() },
  async ({ leaveId, comments }) => {
    const result = await callAgentAction('leave.approve', { leaveId, comments }, randomIdempotencyKey());
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'reject_leave',
  'Reject a pending leave request',
  { leaveId: z.string().uuid(), comments: z.string().optional() },
  async ({ leaveId, comments }) => {
    const result = await callAgentAction('leave.reject', { leaveId, comments }, randomIdempotencyKey());
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool('list_pending_approvals', 'List pending leave and agent approvals', {}, async () => {
  const result = await callAgentAction('approvals.pending', {});
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  'send_shoutout',
  'Send a shoutout with points to colleagues',
  {
    message: z.string().min(1),
    recipients: z.array(
      z.object({
        recipientId: z.string().uuid(),
        points: z.number().int().positive().optional(),
      }),
    ),
  },
  async (params) => {
    const result = await callAgentAction('shoutout.send', params, randomIdempotencyKey());
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'get_payroll_run_status',
  'Get payroll run status by ID',
  { runId: z.string().uuid() },
  async ({ runId }) => {
    const result = await callAgentAction('payroll.run.status', { runId });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'create_payroll_run',
  'Create a draft payroll run (queued for admin approval)',
  {
    title: z.string(),
    frequency: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    paymentDate: z.string(),
    baseCurrency: z.string().default('NGN'),
    employeeIds: z.array(z.string().uuid()),
  },
  async (params) => {
    const result = await callAgentAction('payroll.run.create', params, randomIdempotencyKey());
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

function randomIdempotencyKey(): string {
  return randomUUID();
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
