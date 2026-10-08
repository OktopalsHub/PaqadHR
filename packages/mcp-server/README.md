# PaqadHR MCP Server

Curated MCP tools for HR agents. Wraps the PaqadHR agent action gateway.

## Tools

| Tool | Agent action |
|------|----------------|
| `list_employees` | `employees.list` |
| `get_leave_balance` | `leave.balance` |
| `request_leave` | `leave.request` |
| `approve_leave` | `leave.approve` |
| `reject_leave` | `leave.reject` |
| `list_pending_approvals` | `approvals.pending` |
| `send_shoutout` | `shoutout.send` |
| `get_payroll_run_status` | `payroll.run.status` |
| `create_payroll_run` | `payroll.run.create` |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PAQADHR_API_URL` | No | API base URL (default `http://localhost:9001`) |
| `PAQADHR_API_KEY` | Yes | Tenant API key (`paq_...`); workspace is derived from the key |

`PAQADHR_TENANT_ID` is no longer required (deprecated if still set).

## Cursor configuration

```json
{
  "mcpServers": {
    "paqadhr": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "PAQADHR_API_URL": "http://localhost:9001",
        "PAQADHR_API_KEY": "paq_..."
      }
    }
  }
}
```

Build first: `pnpm --filter @paqadhr/mcp-server build`

Copy the suggested API URL and MCP config snippet from **Settings → Integrations → API keys** in the PaqadHR web app after creating a key.
