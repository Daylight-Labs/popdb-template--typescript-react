# PopDB TypeScript + React Template

## App Overview

This is the official PopDB template for TypeScript + React + Vite applications. It is cloned when users start a new PopDB webapp. It provides a minimal, working scaffold with a pre-built PopDB HTTP library and reliable environment configuration.

## What is PopDB?

PopDB is a managed backend platform providing PostgreSQL, auth, a PostgREST REST API, event handlers, cron triggers, and webhooks. Key concepts:

- **Database**: PostgreSQL accessed via PostgREST (REST API auto-generated from schema)
- **Auth**: JWT-based. Login/register returns `accessToken` + `refreshToken`. Tokens must be sent as `Authorization: Bearer <token>` on every request.
- **Environment header**: Every API request must include `x-popdb-environment: staging` or `x-popdb-environment: production`
- **Event handlers**: Server-side TypeScript functions that run in response to events. This is the only place secrets/API keys should be used.
- **Staging vs Production**: Each app has two isolated environments. The MCP manages staging; production is promoted via the Admin UI.

## Tech Stack

- React 19 + TypeScript
- Vite 6 (bundler, mode-based env loading)
- No CSS framework — plain CSS

## Project Structure

```
src/
  lib/
    popdb.ts      # PopDB HTTP library — auth, token management, REST fetch, query helpers
  App.tsx         # Main app component (replace with your UI)
  App.css         # Minimal base styles
  main.tsx        # React entry point + env validation
  env.d.ts        # TypeScript types for import.meta.env (VITE_ vars)
.env.staging      # Staging environment config (MCP writes after clone)
.env.production   # Production environment config (MCP writes after clone)
```

## Development Commands

```bash
npm run dev              # Dev server in staging mode (port from $POP_DEV_PORT)
npm run build:staging    # TypeScript check + build with staging env
npm run build:production # TypeScript check + build with production env
npm run preview          # Preview last build locally
```

## Environment Configuration

After cloning, the PopDB MCP writes these files with the correct values for the new app:

**`.env.staging`** and **`.env.production`**:
```
VITE_API_URL=      # PostgREST REST API URL
VITE_AUTH_URL=     # Auth API URL
VITE_ENVIRONMENT=  # staging | production
VITE_APP_ID=       # PopDB app ID
```

Vite auto-loads the correct file based on `--mode staging` / `--mode production`. The app will throw at startup if any of these are missing.

## Using the PopDB Library

All imports from `./lib/popdb` (or `../lib/popdb` from subdirectories).

### Auth

```ts
import { login, register, logout, getMe } from "./lib/popdb";

await login("user@example.com", "password");     // stores tokens in localStorage
await register("user@example.com", "password");  // same
const user = await getMe();                       // fetch current user profile
logout();                                         // clears tokens
```

### REST API (apiFetch)

```ts
import { apiFetch } from "./lib/popdb";

// List
const todos = await apiFetch<Todo[]>("todos", {
  query: { order: "created_at.desc" },
  limit: 50,
});

// Create (return created row)
const todo = await apiFetch<Todo>("todos", {
  method: "POST",
  body: { title: "New todo", user_id: userId },
  prefer: "return=representation",
  single: true,
});

// Update
await apiFetch("todos", {
  method: "PATCH",
  query: { id: eq(id) },
  body: { title: "Updated" },
});

// Delete
await apiFetch("todos", {
  method: "DELETE",
  query: { id: eq(id) },
});

// Embed relationships (PostgREST resource embedding)
const films = await apiFetch<Film[]>("films", {
  query: { select: "*,directors(id,name),actors!inner(first_name,last_name)" },
});
```

`apiFetch` automatically:
- Attaches `Authorization` and `x-popdb-environment` headers
- Retries once on 401 after refreshing the access token
- Deduplicates concurrent refresh attempts

**Pagination**: The server enforces a max of 1,000 rows. Always pass `limit` explicitly.

### Query Helpers (filter values)

```ts
import { eq, neq, gt, gte, lt, lte, in_, isNull, isNotNull, is,
         like, ilike, match, imatch, fts, contains, containedBy,
         not, or } from "./lib/popdb";

// Comparison
query: { status: eq("active"), age: gt(18), id: in_(["a", "b"]) }

// Null checks
query: { deleted_at: isNull(), confirmed_at: isNotNull() }

// Pattern matching
query: { name: ilike("%smith%"), code: match("^[A-Z]{3}$") }

// Full-text search
query: { title: fts("typescript react") }

// Array/JSON containment
query: { tags: contains(["react", "typescript"]) }

// Negate any operator
query: { status: not(eq("deleted")) }

// Logical OR (key is "or", value wraps conditions with column names)
query: { or: or("age.gt.18", "status.eq.active") }
```

### Aggregate Helpers (select fragments)

```ts
import { count, sum, avg, min, max } from "./lib/popdb";

// Simple aggregate
apiFetch("orders", { query: { select: sum("amount", "total") } })
// → ?select=total:amount.sum()

// Multiple aggregates
apiFetch("orders", { query: { select: `${sum("amount","total")},${count()}` } })

// Group by (automatic when mixing aggregate + plain columns)
apiFetch("orders", { query: { select: `${sum("amount")},status` } })
```

**Performance**: Aggregates scan entire result sets. Ensure filtered/aggregated columns are indexed. For large tables, prefer pre-aggregating via materialized views or summary tables updated by event handlers.

## PopDB Integration Patterns

1. **Server-side operations requiring secrets** (external API calls, email, AI) must use PopDB event handlers — never expose secrets in client code or `VITE_*` env vars.
2. **Non-secret config** like `VITE_API_URL` is fine in env files.
3. **API keys for integrations** are configured in the PopDB Admin UI, not in code.
4. **Third-party APIs** without a built-in integration: use `ctx.integrations.http` inside an event handler.
5. **Never create a separate backend/proxy server** — PopDB event handlers are the server-side layer.

### Emitting Events from the Frontend

```ts
// POST to the events endpoint (uses VITE_EVENTS_URL + VITE_EVENTS_API_KEY if needed)
// Or trigger via apiFetch to a PopDB function endpoint
```

## PostgREST Quick Reference

PostgREST auto-generates a REST API from your database schema. Key patterns:

- `GET /table` — list rows (filtered by RLS policy)
- `POST /table` — insert row; add `Prefer: return=representation` + `single: true` to get the created row back
- `PATCH /table?col=eq.val` — update matching rows
- `DELETE /table?col=eq.val` — delete matching rows
- `select` param controls columns + embedded resources: `?select=*,relation(col1,col2)`
- `order` param: `?order=created_at.desc,name.asc`
- RLS policies automatically filter rows based on the JWT — users only see their own data (for `owner`-access tables)

## Updating This File

Update this CLAUDE.md when:
- New major dependencies are added
- The project structure changes significantly
- New PopDB features or patterns are adopted
- The build or dev workflow changes
