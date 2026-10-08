# Mastra adoption assessment

Status: **do not adopt** (2026-10-07)  
Scope: whether to add [Mastra](https://mastra.ai) as an LLM/orchestrator layer beside `agent-actions`  
Related: [`ai-plan.md`](../ai-plan.md) decisions D1–D2, Phase 3

## Verdict

Skip Mastra. Keep the existing tool gateway (`AgentActionsService.execute`) and, when an in-product brain is needed, own a small `LlmProvider` loop as already specified in `ai-plan.md`.

## Why (mapped to our constraints)

| Constraint | Mastra impact |
|---|---|
| **D1 — `execute()` is the sole tool primitive** | Mastra tools would wrap or bypass our gateway. Dual tool graphs drift from `AGENT_ACTION_REQUIRED_SCOPES`, HITL (`HIGH_RISK_AGENT_ACTIONS`), idempotency, and activity audit. |
| **D2 — no LangChain-family frameworks** | Mastra is the same class of dependency: agent runtime + abstractions that want to own tools, memory, and the loop. We already rejected that cost/attack-surface tradeoff. |
| **D4 — chat auth is JWT (per-user RBAC)** | Our API-key agent path has no user. A framework chat stack that defaults to “agent credentials” fights the product model. |
| **Security mandate** | Extra runtime surface (prompts, tool adapters, memory stores) without replacing guards we already have. Failures must stay on stable error codes in `docs/agent-api-auth.md`. |
| **What we already ship** | Semantic actions, MCP server, approval queue, scopes, feature gates. The missing piece is a thin loop + persistence — not a second platform. |

## What we would use Mastra *for* (and cheaper substitutes)

| Desire | Substitute already planned / present |
|---|---|
| Tool calling loop | ~150–200 line orchestrator calling `execute()` (ai-plan Phase 3) |
| Typed tools | `@paqadhr/contracts` + `validateAgentActionParams` + MCP tools |
| Memory / threads | Postgres `agent_runs` / steps (ai-plan), not in-process framework memory |
| Observability | Existing correlation id + Sentry/PostHog |
| External agents | MCP + `POST /agent/actions` (no in-process LLM required) |

## When to reopen

Revisit only if **all** of these become true:

1. We need multi-agent graphs or durable workflow DSL that we refuse to own.
2. The hand-rolled loop exceeds ~500 lines *and* keeps growing for framework-shaped problems (not missing HR actions).
3. Mastra (or successor) can call **only** `AgentActionsService.execute` with our auth context — no parallel tool registry.

Until then: deepen handlers + scopes (done in this pass), expand action coverage, finish Phase 3 entrypoints — not add Mastra.
