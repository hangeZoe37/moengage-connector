# Master Code Review & Production Hardening Plan

## 🔍 Executive Summary

I've audited every file across backend (`src/`), frontend (`public/`, `dashboard-ui/`), database (`migrations/`), configuration (`.env`, `package.json`), and documentation. The architecture is **fundamentally sound** — clean layered separation (routes → controllers → services → repositories), proper use of mappers as pure functions, and good async patterns. However, there are **25+ issues** that must be fixed before production deployment for resilience, security, and scalability under heavy load.

---

## ⚖️ Kafka / Docker / Kubernetes — Do You Need Them?

> [!IMPORTANT]
> **Short answer: No, not right now. Your architecture will work fine without them.**

| Technology | When You'd Need It | Your Situation |
|---|---|---|
| **Kafka** | Millions of messages/day, multi-consumer event pipelines | You're processing MoEngage → SPARC → DLR in a synchronous flow with ~500 req/min rate limit. `setImmediate()` background processing is sufficient. |
| **Docker** | Reproducible builds, CI/CD pipelines, multi-service deployments | Nice-to-have for deployment consistency, but **PM2 + Nginx on a single VPS** is perfectly production-viable for your load. |
| **Kubernetes** | Auto-scaling across dozens of pods, multi-region failover | Massive overkill. You're a single-purpose connector, not a distributed microservice mesh. |

**What you SHOULD use instead:**
- **PM2 cluster mode** (already implied in your docs) — gives you multi-core scaling on a single server
- **Nginx reverse proxy** — handles SSL termination, static assets, IP allowlisting
- **MySQL connection pooling** — already implemented ✅
- The fixes below will make this deployment-ready without Kafka/Docker/K8s overhead.

---

## 🚨 Critical Issues (Must Fix Before Deploy)

### 1. SECURITY: `.env` contains real credentials in Git history

**File**: [.env](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/.env)

Your `.env` file has **real production SPARC passwords** (`6?aRp2xyk@Zw%(b3`), real DB passwords, and a local-only `MOENGAGE_DLR_URL`. While `.env` is in `.gitignore`, these credentials are visible in the workspace.

> [!CAUTION]
> Before deploying, rotate ALL credentials that appear in the `.env` file. On the production server, use a fresh `.env` with production-only values.

---

### 2. RESIDUAL CODE: Test endpoint in production app

**File**: [app.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/app.js) (Lines 43-50)

```js
// Dummy endpoint for testing MoEngage callbacks locally without 404s
app.post('/test/moengage-dlr', (req, res) => { ... });
```

This **must be removed**. It accepts unauthenticated POST requests and dumps full payloads to stdout. An attacker could use it to probe the server. Uses `console.dir` which bypasses structured logging.

**Fix**: Remove the entire block. If you need it in dev, gate it behind `NODE_ENV === 'development'`.

---

### 3. RESILUAL CODE: `mammoth` dependency

**File**: [package.json](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/package.json) (Line 17)

```json
"mammoth": "^1.12.0",
```

This is a Word-to-HTML converter library. **It is not used anywhere in the codebase.** It adds unnecessary attack surface and bloats `node_modules`.

**Fix**: Remove from `package.json` and run `npm prune`.

---

### 4. RESILIENCE: Process crash on unhandled rejections

**File**: [server.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/server.js)

There are **no handlers** for `unhandledRejection` or `uncaughtException`. If any async code throws without a catch (e.g., a DB connection drop during a `setImmediate` callback), the entire Node.js process crashes silently.

**Fix**: Add crash-safe handlers that log the error and allow PM2 to restart gracefully.

---

### 5. RESILIENCE: `setImmediate` async errors are swallowed silently

**File**: [sparcWebhook.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/routes/sparcWebhook.js) (Lines 46-61, 79-137)

The `setImmediate(async () => { ... })` pattern wraps the inner logic in try/catch, which is good. But if the catch block itself throws (e.g., logger fails), the error becomes an unhandled rejection. This is mitigated by fix #4 above.

---

### 6. SECURITY: Admin routes use Bearer auth meant for MoEngage clients

**File**: [routes/admin.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/routes/admin.js) (Line 15)

```js
router.use(bearerAuth);
```

Admin routes reuse the same `bearerAuth` middleware that authenticates MoEngage API clients. This means **any MoEngage client bearer token can access admin endpoints** (client management, stats, message explorer). This is a privilege escalation vulnerability.

**Fix**: Create a separate `adminAuth` middleware that checks for a dedicated `ADMIN_BEARER_TOKEN` env var, separate from client tokens.

---

### 7. SECURITY: Basic auth uses hardcoded fallback password

**File**: [basicAuth.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/middleware/basicAuth.js) (Line 13)

```js
const password = env.DASHBOARD_PASSWORD || 'admin123';
```

If `DASHBOARD_PASSWORD` is not set (it's not in `.env` or `.env.example`), anyone can log in with `admin:admin123`.

**Fix**: Make `DASHBOARD_PASSWORD` a required env var. Fail at startup if missing.

---

### 8. SCALABILITY: No graceful shutdown

**File**: [server.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/server.js)

When PM2 sends SIGTERM for a restart/deploy, the process dies immediately. In-flight requests (especially `setImmediate` background tasks processing messages) are lost without any record.

**Fix**: Implement graceful shutdown that stops accepting new connections, waits for in-flight requests, and drains the DB pool.

---

### 9. DATABASE: No index on `sparc_transaction_id`

**File**: [final_schema.sql](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/migrations/final_schema.sql)

`messageRepo.findBySparcTransactionId()` does a full table scan on `message_logs` because there's no index on `sparc_transaction_id`. Under heavy SMS load, this query will degrade.

**Fix**: Add `INDEX idx_sparc_txn_id (sparc_transaction_id)` to `message_logs`.

---

### 10. DATABASE: SQL injection vector via string interpolation

**Files**: [messageRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/messageRepo.js) (Line 154), [dlrRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/dlrRepo.js) (Line 75), [adminRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/adminRepo.js) (Line 146)

```js
sql += ` ORDER BY m.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)} `;
```

While `Number()` provides some protection, this is string interpolation in SQL. Use parameterized placeholders (`LIMIT ? OFFSET ?`) consistently.

---

### 11. RESILIENCE: `dlrRepo.create()` returns wrong shape for `insertId`

**File**: [dlrController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/dlrController.js) (Line 81)

```js
await dlrRepo.markDispatched(dlrResult.insertId);
```

The `db.query()` helper returns `rows` (the result of `pool.execute`). For INSERT statements, `rows` is a `ResultSetHeader` object. `dlrResult.insertId` should work because mysql2 returns `insertId` on ResultSetHeader, **but** the `query()` docstring says it returns "Query result rows" which is misleading. This works but is fragile.

---

### 12. RESIDUAL CODE: `sms-fallback-standalone/` directory

**Directory**: [sms-fallback-standalone/](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/sms-fallback-standalone)

This is a complete standalone SMS server with its own `server.js` and `mapper.js`. SMS fallback is already fully integrated into the main codebase (`fallbackEngine.js`, `sparcClient.sendSMS()`). This directory is dead code.

**Fix**: Delete the entire `sms-fallback-standalone/` directory.

---

### 13. RESILIENCE: `.env.example` is stale/inconsistent with actual `.env`

**File**: [.env.example](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/.env.example)

- References `SPARC_DLR_WEBHOOK_URL` and `SPARC_INTERACTION_WEBHOOK_URL` which don't exist in env.js (the actual var is `SPARC_WEBHOOK_URL`)
- References `workspace_tokens` table which no longer exists (replaced by `clients`)
- Missing `DASHBOARD_PASSWORD`, `ADMIN_BEARER_TOKEN`

**Fix**: Synchronize `.env.example` with actual env.js required/optional vars.

---

### 14. SCALABILITY: No response compression

**File**: [app.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/app.js)

Dashboard API responses (logs, metrics) can be large JSON payloads. No `compression` middleware is configured. Under heavy dashboard usage this wastes bandwidth.

**Fix**: Add `compression` middleware for API responses.

---

### 15. SCALABILITY: No request timeout middleware

**File**: [app.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/app.js)

If an upstream (SPARC API, MoEngage DLR) hangs beyond the axios timeout, Express request handlers can pile up. There's no server-level request timeout to kill stale connections.

**Fix**: Set `server.timeout` and `server.keepAliveTimeout` in `server.js`.

---

### 16. RESILIENCE: Dashboard `deactivateClient` actually DELETEs

**Files**: [dashboardController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/dashboardController.js) (Line 192 comment says "Soft-deactivates"), [clientRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/clientRepo.js) (Line 104)

The JSDoc says "Soft-deactivates" but the actual SQL is `DELETE FROM clients WHERE id = ?`. This is a **permanent destructive action** that also cascades `SET NULL` on all associated `message_logs`. Meanwhile, `adminController.toggleClientStatus` does the correct `UPDATE is_active = NOT is_active`.

**Fix**: Change `deactivateClient` to actually soft-delete (`UPDATE clients SET is_active = 0`), or rename it to `deleteClient` with appropriate warnings.

---

### 17. SCALABILITY: DB connection pool size is hardcoded low

**File**: [env.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/config/env.js) (Line 27)

Default pool size is 10. Under heavy load with PM2 cluster mode (e.g., 4 workers), that's 40 connections. MySQL default `max_connections` is 151, so this is fine, but should be documented and tunable via env.

**Status**: Already configurable via `DB_POOL_SIZE` env var ✅. Just needs higher default for production (recommend 20).

---

### 18. RESILIENCE: Health check doesn't report memory/event loop lag

**File**: [health.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/routes/health.js)

Current health check only tests DB connectivity. For production monitoring, should also report memory usage and event loop responsiveness.

**Fix**: Enhance health endpoint with memory stats and process info.

---

### 19. TRANSPARENCY: Inline `require()` calls in hot paths

**Files**: [dlrController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/dlrController.js) (Line 134), [inboundController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/inboundController.js) (Line 49), [interactionController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/interactionController.js) (Line 67), [adminController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/adminController.js) (Line 95)

```js
const { notifyUpdate } = require('../services/dashboardService');  // inside function body
const { query } = require('../config/db');  // inside function body
```

Inline `require()` calls are used to avoid circular dependencies, but they add overhead on every invocation and make dependency graphs opaque. Move to top-level imports.

---

### 20. RESIDUAL CODE: Stale comment `// ;` in interactionController

**File**: [interactionController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/interactionController.js) (Line 12)

```js
// ;
```

Dead comment from a deleted import line.

---

### 21. RESILIENCE: `inboundController.processMessages` crash on missing `content.type`

**File**: [inboundController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/inboundController.js) (Line 53)

```js
message_type: message.content.type,  // dashboard notify
```

If `message.content` is undefined (possible if `validatePayload` hoisting fails), this throws `TypeError: Cannot read properties of undefined`. The earlier assignment on line 27 safely handles this with optional chaining, but line 53 doesn't.

---

### 22. SCALABILITY: `adminRepo.getDlrTracker` loads all stuck DLRs into memory

**File**: [adminController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/adminController.js) (Lines 154-160)

```js
const rows = await adminRepo.getDlrTracker(filters);
const paginated = rows.slice(offset, offset + limit);
```

Fetches ALL stuck DLRs from DB then paginates in memory. Under heavy load with thousands of stuck DLRs, this wastes memory and DB bandwidth.

**Fix**: Apply `LIMIT ? OFFSET ?` directly in the SQL query.

---

### 23. SECURITY: `updateClient` accepts raw `req.body` without validation

**Files**: [dashboardController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/dashboardController.js) (Line 176), [adminController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/adminController.js) (Line 76)

```js
await clientRepo.updateClient(id, req.body);
```

While `clientRepo.updateClient` has an allowlist filter, `req.body` is passed directly. If someone sends `{ "bearer_token": "..." }`, it would be silently ignored because `bearer_token` isn't in the allowlist. But `is_active` is also not in the allowlist, which means the dashboard can't accidentally disable a client through the update endpoint. This is actually correct behavior, but should be documented.

---

## Proposed Changes

### Component 1: Server Hardening

#### [MODIFY] [server.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/server.js)
- Add `unhandledRejection` and `uncaughtException` handlers
- Add graceful shutdown on `SIGTERM`/`SIGINT` (drain connections, stop accepting requests)
- Set `server.keepAliveTimeout` and `server.headersTimeout` for load balancer compatibility

---

### Component 2: Remove Residual/Dead Code

#### [MODIFY] [app.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/app.js)
- Remove `/test/moengage-dlr` dummy endpoint
- Add `compression` middleware
- Add `helmet` security headers middleware

#### [MODIFY] [package.json](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/package.json)
- Remove `mammoth` dependency
- Add `compression` and `helmet` dependencies

#### [DELETE] `sms-fallback-standalone/` directory
- Entire directory is dead code, SMS fallback is in main codebase

---

### Component 3: Security Fixes

#### [MODIFY] [basicAuth.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/middleware/basicAuth.js)
- Remove hardcoded `'admin123'` fallback — require `DASHBOARD_PASSWORD` env var

#### [NEW] [adminAuth.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/middleware/adminAuth.js)
- Dedicated admin auth middleware checking `ADMIN_BEARER_TOKEN` env var
- Separate from client bearer tokens

#### [MODIFY] [routes/admin.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/routes/admin.js)
- Switch from `bearerAuth` to new `adminAuth`

#### [MODIFY] [env.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/config/env.js)
- Add `DASHBOARD_PASSWORD` and `ADMIN_BEARER_TOKEN` to required vars
- Increase default `DB_POOL_SIZE` to 20

---

### Component 4: Database & Query Fixes

#### [MODIFY] [final_schema.sql](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/migrations/final_schema.sql)
- Add index on `sparc_transaction_id`
- Add index on `dlr_events.callback_dispatched` for stuck-DLR queries

#### [MODIFY] [messageRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/messageRepo.js)
- Use parameterized `LIMIT ? OFFSET ?` instead of string interpolation

#### [MODIFY] [dlrRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/dlrRepo.js)
- Use parameterized `LIMIT ? OFFSET ?`

#### [MODIFY] [adminRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/repositories/adminRepo.js)
- Add SQL-level pagination to `getDlrTracker` instead of in-memory slicing
- Use parameterized `LIMIT ? OFFSET ?`

#### [MODIFY] [clientRepo.js](file:///c:/Users/vaibhavi.sharma/Desktop\moengage_connector/src/repositories/clientRepo.js)
- Change `deactivateClient` to soft-delete (`UPDATE SET is_active = 0`) to match JSDoc

---

### Component 5: Resilience & Transparency Fixes

#### [MODIFY] [health.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/routes/health.js)
- Add memory usage, event loop lag, and active connections to health check

#### [MODIFY] [dlrController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/dlrController.js)
- Move inline `require()` to top-level import

#### [MODIFY] [inboundController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/inboundController.js)
- Move inline `require()` to top-level import  
- Fix unsafe `message.content.type` access on line 53

#### [MODIFY] [interactionController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/interactionController.js)
- Remove stale `// ;` comment
- Move inline `require()` to top-level import

#### [MODIFY] [adminController.js](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/src/controllers/adminController.js)
- Move inline `require()` to top-level import

---

### Component 6: Configuration Sync

#### [MODIFY] [.env.example](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/.env.example)
- Sync with actual env.js vars (remove stale, add missing)
- Add `DASHBOARD_PASSWORD` and `ADMIN_BEARER_TOKEN`

#### [MODIFY] [.gitignore](file:///c:/Users/vaibhavi.sharma/Desktop/moengage_connector/.gitignore)
- Remove duplicate `antigravity-skills/` entry

---

## Open Questions

> [!IMPORTANT]  
> **Admin Auth Strategy**: The current admin routes (`/admin-api/*`) use the same bearer auth as MoEngage client tokens. I propose creating a separate `ADMIN_BEARER_TOKEN` env var. Do you want a single admin token, or should admin access also be per-client?

> [!IMPORTANT]
> **`deactivateClient` behavior**: The dashboard DELETE endpoint permanently removes clients from the DB. The admin panel PATCH endpoint correctly toggles `is_active`. Should the dashboard endpoint also soft-delete, or do you want permanent deletion to remain available?

---

## Verification Plan

### Automated Tests
1. `npm start` — verify server boots without errors after all env changes
2. `curl http://localhost:3000/health` — verify enhanced health check returns memory stats
3. Verify `/test/moengage-dlr` returns 404 (removed)
4. Verify `SIGTERM` triggers graceful shutdown (logged, connections drained)

### Manual Verification
- Confirm all `.env` required vars fail loudly at startup if missing
- Test admin auth with new `ADMIN_BEARER_TOKEN` (old client tokens should be rejected)
- Verify dashboard basic auth rejects requests when `DASHBOARD_PASSWORD` is wrong
