# Performance Rules (Mandatory for All AI Agents)

Every agent working in this repository **must read and follow this document** before writing, reviewing, or modifying code. Performance failures (N+1 queries, unbounded lists, blocking I/O in transactions) are defects, not optimizations to defer.

**Default stance:** correctness first, no premature caching, but never ship obvious scalability bugs.

---

## Layer Detection

Identify what you are editing from **code signals**, not directory names. TanStack Query may live under `features/`, `hooks/`, route files, or shared packages.

| Layer | Signals | Apply |
|-------|---------|-------|
| Backend API | `@nestjs/*`, TypeORM, repositories, `DataSource`, migrations | Database and API sections below |
| Frontend / client | React, Next.js, components, client hooks | Web section below |
| Data fetching | `@tanstack/react-query`, `useQuery`, `useMutation` | Data-fetching rules wherever they appear |

Do not apply FastAPI/Python patterns unless that stack is present.

---

## Priority Ladder

Follow this order when improving performance:

```
Correctness
    ↓
Efficient queries (no N+1, right indexes)
    ↓
Pagination and selective columns
    ↓
Batching (bulk writes/reads)
    ↓
Async / background processing
    ↓
Caching (only when measured + invalidation defined)
    ↓
Advanced optimization
```

**Do not skip steps.** Add caches only after measuring a bottleneck and defining key, TTL, and invalidation.

---

## Database (TypeORM / PostgreSQL)

### Avoid N+1 queries

Never load related data inside a loop.

```typescript
// Bad — N+1
const members = await this.memberRepository.find({ where: { tenantId } });
for (const member of members) {
  member.department = await this.deptRepository.findOne({ where: { id: member.departmentId } });
}

// Good — eager load or join
const members = await this.memberRepository.find({
  where: { tenantId },
  relations: ['departmentMemberships', 'departmentMemberships.department'],
});
```

Or QueryBuilder with explicit joins.

### Select only the columns you need

**Default rule:** do not load full entities when you only use a few fields. TypeORM `find()` without `select` pulls every column on the table — including large text/json fields you never read.

Ask before every query: *Which fields does this code actually use?* Select only those.

```typescript
// Bad — loads every column on tenant_members (identity fields, notes, etc.)
const members = await this.memberRepository.find({ where: { tenantId } });
return members.map((m) => ({ id: m.id, name: m.firstName }));

// Good — explicit column list
const members = await this.memberRepository.find({
  where: { tenantId },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    preferredName: true,
  },
});

// Good — QueryBuilder for joins with partial selects
const rows = await this.memberRepository
  .createQueryBuilder('member')
  .leftJoin('member.departmentMemberships', 'dm', 'dm.isActive = :active', { active: true })
  .leftJoin('dm.department', 'department')
  .select([
    'member.id',
    'member.firstName',
    'member.lastName',
    'department.name',
  ])
  .where('member.tenantId = :tenantId', { tenantId })
  .getMany();
```

**When to use partial selects:**

- List endpoints, dashboards, dropdowns, counts, existence checks
- Any read where the response DTO uses a subset of entity fields
- Joins where you only need ids or labels from related tables

**When full entity load is OK:**

- Single-record fetch by id immediately followed by update/save on that row
- Logic that genuinely reads most columns or passes the entity to code expecting all fields

**Rules:**

1. List/read paths → `select` or QueryBuilder `.select([...])` matching the response DTO.
2. Never `find()` a wide table and map down to 2–3 fields in memory — push column choice to SQL.
3. Exclude sensitive or heavy columns unless explicitly required (`identity_bvn`, large JSON blobs, encrypted fields, long text).
4. Repository methods should encode the select shape; services should not load full rows and discard fields.

### Query discipline

Every query should answer:

- **Which columns are needed?** (select only those — not the whole entity)
- Do we need all rows? (paginate)
- Can this be filtered with an indexed column?
- Can relations load in one round trip?

### Pagination

**Never return unbounded lists** from endpoints that grow with tenant or user data.

Use `limit` / `offset` or cursor pagination. Default sensible max limits in DTOs (e.g. 100 per page).

Applies to: members, payroll, transactions, notifications, audit logs, search results.

### Indexing

When adding queries on new columns:

- Index foreign keys used in joins and filters
- Index columns in `WHERE`, `ORDER BY`, and tenant scoping
- Do not add indexes blindly — each index costs write amplification

Add indexes in TypeORM migrations for new hot paths.

### Batch writes

Avoid saving one row per iteration.

```typescript
// Bad
for (const row of rows) {
  await this.repository.save(row);
}

// Good
await this.repository.save(rows);
```

For very large inserts, use bulk insert or chunked batches inside a transaction.

### Transactions

- Use `dataSource.transaction()` for multi-step writes that must succeed or fail together.
- Keep transactions **short** — no external HTTP, email, or payment API inside the transaction.
- Commit DB work first; trigger side effects after commit.

### Connection management

- Use injected repositories and `DataSource` — do not create connections per request.

---

## API Layer (NestJS backend)

### Controllers

Controllers validate input, call services, return DTOs. They must **not**:

- Contain heavy computation
- Execute database logic directly
- Loop with per-item DB calls

### Services

- One service method must not fan out into unbounded queries.
- Prefer repository methods with joins, filters, and **explicit column selects**.
- Return only fields the client needs — select at the DB layer, then map to DTOs.
- Do not `find()` full entities and drop unused properties in the service.

### Background work

Move slow or unreliable work off the request path:

- Email → queue or fire-and-forget after commit
- Webhooks → dedicated idempotent handlers
- Catalog sync / crons → scheduled jobs
- Post-debit top-ups → async after redemption

Do not block HTTP responses on third-party APIs when synchronous confirmation is not required.

### Rate limiting

Apply rate limits to expensive public endpoints (forms, uploads, anonymous APIs).

---

## Frontend & Data Fetching (React, Next.js, TanStack Query)

### Data fetching

- TanStack Query may live in `features/`, `hooks/`, route modules, or shared packages — same rules apply everywhere.
- Use appropriate `staleTime` and query keys scoped by tenant/resource.
- Invalidate on mutation instead of blind full-tree refetch.
- Paginate large lists in UI — do not load entire directories into memory.

### Rendering

- Lazy-load heavy tabs/modals when practical.
- Avoid unbounded `useEffect` fetch loops without dependency guards.
- Do not fetch the same data client-side and server-side without reason.

### Bundles

- Dynamic import for rarely used heavy modules.
- Do not import server-only or large libraries into client components.

### API client

- Batch related reads where the API supports it.
- Avoid dozens of parallel calls when one aggregated endpoint exists.

---

## Caching Policy

### Default: no caching

Do **not** add Redis, in-memory caches, or HTTP cache headers unless:

1. You measured a real bottleneck.
2. You defined cache **key**, **TTL**, and **invalidation**.
3. Stale data is acceptable for the TTL or you invalidate on writes.

### Good cache candidates

- Static or slow-changing catalog metadata
- Expensive computed reports (with explicit refresh)
- External API responses with known freshness requirements

### Bad cache candidates

- Balances, pay run state, wallet amounts
- Authorization / role decisions without careful invalidation
- Per-request settings used in security decisions
- Anything where stale data causes financial or compliance errors

---

## Memory and Exports

- Do not load entire tables into memory for CSV/PDF export — stream or paginate.
- Cap export sizes server-side.
- Avoid large buffers in global singletons.

---

## External API Calls

- Never call external APIs inside loops over large datasets without batching.
- Set timeouts on outbound HTTP.
- Use idempotency keys for payment providers.
- Retry with backoff; do not retry infinitely in request handlers.

---

## NestJS-Specific Rules

- Constructor injection — do not `new Service()` in controllers.
- Repositories encapsulate query shapes; services orchestrate logic.
- Use event emitter for decoupled side effects instead of long synchronous chains.

---

## Anti-Patterns

| Anti-pattern | Fix |
|--------------|-----|
| N+1 in loops | `relations` or join query |
| Unpaginated `find()` | limit/offset or cursor |
| Full entity load for list/DTO | `select` / QueryBuilder `.select([...])` |
| `find()` then map to 2–3 fields | select those columns in the query |
| `save()` in loop | `save(array)` or bulk insert |
| Long transaction with HTTP | commit first, async side effects |
| Caching “just in case” | measure first; document invalidation |
| SELECT * on huge tables | select needed columns only |
| Client fires many endpoints on mount | consolidate or use query cache |
| Synchronous email in request | background / fire-and-forget |

---

## Mandatory AI Performance Checklist

Before completing a task:

- [ ] New list endpoints are paginated
- [ ] Queries select only columns needed for the response (no full-entity loads for partial DTOs)
- [ ] No N+1 queries where lists include related data
- [ ] No unnecessary duplicate queries in the same request
- [ ] Writes batched where multiple rows change
- [ ] Transactions short; no external I/O inside
- [ ] No unbounded in-memory arrays from DB reads
- [ ] Expensive work deferred to background/cron/webhook
- [ ] Caching not added without measurement and invalidation plan
- [ ] Web client does not over-fetch or duplicate API calls
- [ ] New filters use indexed columns (migration if needed)

Fix issues at the shared repository/service layer when multiple callers are affected.

---

## Measuring Before Optimizing

1. Identify the slow path (route, query, render).
2. Check query count and plan (N+1 is the most common bug).
3. Trim selected columns — if the DTO uses 5 fields, the query should not fetch 30.
4. Add indexes if filtering/sorting on unindexed columns.
5. Paginate or trim payloads.
6. Batch writes.
7. Only then consider caching or infrastructure.

---

## Philosophy

Performance is part of reliability. Prefer simple, measurable improvements over premature complexity — but never ship N+1 queries or unbounded data loads.

See also: [SECURITY.md](./SECURITY.md) — rate limits, pagination as abuse control, short transactions.
