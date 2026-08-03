# API Security Mandate & Playbook

**Mandatory for all AI agents and human reviewers.** Read this document before writing, reviewing, or modifying code in this repository. Security is not optional and not deferred to a later pass.

**Compliance baseline:** [OWASP API Security Top 10](https://owasp.org/API-Security/), [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [OWASP Top 10](https://owasp.org/www-project-top-ten/), **ASVS Level 2** for production.

---

## Security Pillars (Non-Negotiable)

| Pillar | Strict operational requirement |
|--------|--------------------------------|
| **Authentication** | Zero-trust endpoints. Mandatory signed JWT validation. No route exposed unless explicitly `@Public()`. |
| **Authorization** | Contextual ownership checks on every resource access. Eliminate BOLA / IDOR. |
| **Infrastructure** | Gateway or app-level rate limiting. Edge WAF where deployed. Payload size caps. |
| **Code quality** | Strict schema validation on every incoming payload. Drop unmapped keys. |

---

## Layer Detection

Identify what you are editing from **code signals**, not directory names. Layout varies (`features/`, `hooks/`, `packages/`, etc.).

| Layer | Signals | Apply |
|-------|---------|-------|
| Backend API | `@nestjs/*`, TypeORM, guards, DTOs, controllers, modules | Sections 6 and backend rules below |
| Frontend / SSR | Next.js, React, middleware, route handlers, client components | Section 7 |
| Data fetching | TanStack Query (`@tanstack/react-query`, `useQuery`, `useMutation`) anywhere in the repo | Frontend auth, CSRF, no secret leakage |

Do **not** apply FastAPI, Django, or other stack conventions unless that stack is present in the file you are editing.

---

## 1. Authentication (Identity Verification)

### Zero-trust default

- Every API route requires authentication **unless** decorated with `@Public()`.
- Global `JwtAuthGuard` must remain the default (`APP_GUARD` in `app.module.ts`).
- Never trust client identity from headers, body, or query params without guard-validated JWT/session.

### Token rules

- Validate JWT signature, expiry, and claims on every protected request.
- Prefer asymmetric signing (JWKS / public-key validation) for externally issued tokens; never commit private signing keys.
- **Access token lifespan:** maximum 15 minutes for high-security contexts; configure via env.
- **Refresh tokens:** independent, cryptographically signed, stored in **httpOnly, Secure, SameSite** cookies — never in `localStorage`, sessionStorage, or URL query params.
- **Refresh rotation:** issue a new refresh token on each refresh; on reuse of a rotated token, revoke all sessions for that user.
- **Session binding:** embed session id (`sid`) in access JWT; validate active session on each request when sessions are used.
- Never return password-reset, OTP, or magic-link tokens in API JSON — deliver via email only.

### Ban weak patterns

- No basic auth on production endpoints.
- No long-lived access tokens in client-accessible storage.
- No `alg=none` or unsigned tokens.

---

## 2. Authorization (Access Controls)

### BOLA / IDOR eradication

Never assume a valid user owns the resource they request.

```typescript
// Bad — trusts ID alone
await this.repository.findOne({ where: { id } });

// Good — ownership + tenant scope
await this.repository.findOne({ where: { id, tenantId, memberId: actor.memberId } });
```

- Multi-tenant: every query scopes by `tenantId` and proves membership via guards.
- UUIDs are identifiers, **not** authorization.
- Use `@ActiveUser()` / request auth context — do not re-parse JWT in controllers.

### Property-level access (mass-assignment prevention)

- DTO `whitelist` strips fields users must not set (e.g. `role`, `isAdmin`, `tenantId` on create).
- Response DTOs expose only authorized fields; never leak internal columns.
- `forbidNonWhitelisted: true` — hard-fail on unexpected payload keys.

### Least-privilege RBAC

- Destructive, billing, and admin actions require explicit role guards (`OWNER`, `ADMIN`, etc.).
- Deny by default; explicitly allow scopes/roles per endpoint.
- Step-up auth (OTP) for password change and payment-method changes.

---

## 3. Data Integrity & Content Validation

### Contract validation (every payload)

Global `ValidationPipe` in `main.ts`:

```typescript
new ValidationPipe({
  whitelist: true,            // strip non-decorated properties
  forbidNonWhitelisted: true, // HTTP 400 on malicious extra keys
  transform: true,            // cast primitives safely
});
```

- Every `@Body()`, `@Query()`, and `@Param()` used in logic must use a validated DTO with `class-validator`.
- Bind endpoints to strict schemas; reject unmapped keys, wrong types, illegal characters.
- CI enforces DTO imports on `@Body()` (`.github/scripts/check-body-dto-imports.mjs`).

### Input sanitization

- Treat every parameter as hostile.
- Use parameterized ORM queries — **never** interpolate user input into SQL.
- Do not rely on keyword blocklists as primary SQL injection defense.
- Encode or sanitize untrusted output (XSS prevention on web).

### Database

- TypeORM repositories and parameterized QueryBuilder only.
- Transactions for multi-table writes; keep transactions short — no external HTTP inside.

---

## 4. Traffic Control & Infrastructure Edge

### Tiered rate limiting

| Tier | Target limit |
|------|----------------|
| Unauthenticated (per IP) | 60 requests / minute |
| Authenticated (per user) | 1000 requests / minute |
| Sensitive flows (login, OTP, apply, upload) | Stricter per-route limits |

- Return `429` with `Retry-After` when exceeded.
- Use Redis-backed limits when `REDIS_URL` is set (multi-instance); in-memory acceptable for single instance only.

### Payload and upload constraints

- Reject request bodies exceeding **10 MB** unless explicitly justified and guarded.
- File uploads: MIME allowlist, size cap, random storage keys, private ACL for PII.

### Webhooks and public endpoints

Separate trust boundary: signature verification on raw body, rate limits, DTO validation, idempotency on money paths.

---

## 5. Observability & Logging

### Zero PII in logs

Never log: passwords, JWTs, refresh tokens, OTP codes, API keys, full credit card data, bank tokens, BVN/NIN, full webhook payloads with PII.

Mask or omit sensitive fields at runtime.

### Traceability

- Propagate `X-Correlation-ID` from gateway/client through API and outbound calls.
- Generate correlation id when absent; echo on response headers.
- Structured logs must support audit reconstruction without exposing secrets.

---

## 6. NestJS Backend Patterns

### Global JWT guard (zero-trust identity)

```typescript
// Pattern: src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

Register as global guard. Only `@Public()` routes skip authentication.

### Contextual resource ownership

```typescript
// Service layer — always verify ownership
async updateIfOwned(id: string, userId: string) {
  const resource = await this.repo.findOne({ where: { id, ownerId: userId } });
  if (!resource) throw new NotFoundException();
  // ...
}
```

### Tenant isolation flow

```
Request → JwtAuthGuard → TenantMemberGuard → TenantRoleGuard → Controller → Service → DB (tenantId scoped)
```

### Errors

Throw Nest HTTP exceptions. Never return stack traces or internal details in production.

### Webhooks and payments

- Verify HMAC signatures on raw body.
- Idempotency keys for credits and subscription events.
- Validate provider tag before wallet credit.

### Secrets

Environment variables or secret stores only — never in git.

---

## 7. Next.js Client & SSR Patterns

### Secure session storage

- **Rule:** Never store JWTs, API keys, or refresh tokens in `localStorage` or client-accessible globals.
- **Action:** httpOnly, `Secure`, `SameSite=Strict` (or `Lax` where needed) cookies via API auth.
- API client: `credentials: 'include'` + CSRF token on mutating requests.

### Server-side route handlers (`app/api/**`)

If adding Next.js API routes:

- Authenticate on the server before business logic.
- Forward correlation id to backend.
- Never expose backend secrets to the client.

### XSS and CSP

- Avoid `dangerouslySetInnerHTML` unless sanitized.
- CSP in middleware with per-request nonces in production (`script-src` without `unsafe-inline`).
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.

### Environment

- Only `NEXT_PUBLIC_*` in browser bundles.
- Never embed signing keys or API secrets in client code.

---

## 8. OWASP API Security Top 10 — Required Controls

| Risk | Required behavior |
|------|-------------------|
| **API1: BOLA** | Ownership + tenant scope on every read/write |
| **API2: Broken authentication** | Global guard, session binding, refresh rotation, secure cookies |
| **API3: Broken object property level auth** | DTO whitelist; filtered responses |
| **API4: Unrestricted resource consumption** | Rate limits, pagination, payload/upload caps |
| **API5: Broken function level auth** | Role guards on admin/destructive/billing |
| **API6: Unrestricted sensitive business flows** | OTP step-up; idempotency on payments |
| **API7: SSRF** | No arbitrary URL fetch from user input |
| **API8: Security misconfiguration** | Env validation, CORS allowlist, security headers |
| **API9: Improper inventory management** | No shadow/deprecated exposed endpoints |
| **API10: Unsafe consumption of APIs** | Webhook signature verify; outbound timeouts |

---

## 9. Eliminate Shadow APIs

- No undocumented or unauthenticated endpoints.
- Deprecate and lock old API versions when superseded.
- Do not add endpoints that bypass authorization (e.g. create notifications for arbitrary users).
- Webhooks: dedicated paths with signature verification only.

---

## 10. Dependency & Release Security

Before every release:

```bash
pnpm audit --audit-level=high
```

- Maintain transitive fixes in root `package.json` → `pnpm.overrides`.
- Keep lockfile committed.
- CI runs audit on API and web workflows.

---

## 11. Secure Coding Rules

1. Validate all input (DTOs / ValidationPipe).
2. Encode or sanitize all untrusted output.
3. Parameterized queries / ORM only.
4. Least privilege on every endpoint.
5. Deny by default; explicitly allow roles.
6. Verify resource ownership on every read/write.
7. Validate file uploads (type, size, content).
8. Validate URLs before server-side fetch (SSRF).
9. Keep dependencies updated.
10. Rotate secrets on compromise.
11. Encrypt sensitive fields at rest (PII, payment identity).
12. Never trust client-side validation alone.
13. Prefer allowlists over blocklists.
14. Fail securely — safe defaults on error.
15. Fix shared functions once at the root cause.

---

## 12. Mandatory AI Review Checklist

Before completing any task that touches backend API or frontend/client code:

- [ ] SQL / NoSQL injection
- [ ] XSS (stored, reflected, DOM)
- [ ] CSRF on state-changing routes
- [ ] IDOR / BOLA / cross-tenant access
- [ ] Missing authentication (`@Public()` only where intended)
- [ ] Missing authorization / role guards
- [ ] Mass-assignment / unexpected payload keys blocked
- [ ] Tenant isolation where applicable
- [ ] File upload vulnerabilities
- [ ] SSRF (user-controlled URLs)
- [ ] Hardcoded secrets or credentials
- [ ] Weak cryptography or plaintext secrets at rest
- [ ] Missing input validation (DTO)
- [ ] Rate limits on public/abusable endpoints
- [ ] Payload size within limits
- [ ] Sensitive data in logs or API responses
- [ ] Correlation id propagated where applicable
- [ ] Payment/webhook idempotency and signature verification
- [ ] OWASP API Top 10 regressions
- [ ] Shadow or unauthenticated endpoints introduced

**If an issue is found:** explain briefly, fix at the shared layer when multiple callers exist, do not leave known vulnerabilities in the final diff.

---

## Vulnerability Reporting

Do not open public GitHub issues for security vulnerabilities. Report privately to **support@paqad.com**.

Include: description, steps to reproduce, affected endpoint/module, impact, optional mitigation.

---

## Security Philosophy

Security is built into every stage of development — not added at the end. Zero trust at boundaries, least privilege, defense in depth, continuous validation.
