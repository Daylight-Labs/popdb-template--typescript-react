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
```

## Environment Configuration

After cloning, the PopDB MCP writes `.env.staging` and `.env.production` with `VITE_API_URL`, `VITE_AUTH_URL`, `VITE_ENVIRONMENT`, and `VITE_APP_ID`. Vite auto-loads the correct file based on the `--mode` flag. The app throws at startup if any are missing.

## PopDB Library (`src/lib/popdb.ts`)

Pre-built helpers — read the file for full details:

- **Auth**: `login`, `register`, `logout`, `getMe`, `refreshSession`
- **Token management**: `getAccessToken`, `clearTokens`, etc. (localStorage)
- **REST**: `apiFetch<T>(path, options)` — auto-attaches auth + environment headers, handles 401 with token refresh, supports `limit`, `offset`, `single`, `prefer`
- **PostgREST query helpers**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in_`, `isNull`, `isNotNull`, `like`, `ilike`, `match`, `imatch`, `fts`, `contains`, `containedBy`, `not`, `or`
- **Aggregate helpers**: `count`, `sum`, `avg`, `min`, `max` — use with caution, ensure indexed columns; server max is 1,000 rows per request

## PopDB Integration Patterns

1. **Server-side operations requiring secrets** (external API calls, email, AI) must use PopDB event handlers — never expose secrets in client code or `VITE_*` env vars.
2. **Non-secret config** like `VITE_API_URL` is fine in env files.
3. **API keys for integrations** are configured in the PopDB Admin UI, not in code.
4. **Third-party APIs** without a built-in integration: use `ctx.integrations.http` inside an event handler.
5. **Never create a separate backend/proxy server** — PopDB event handlers are the server-side layer.

## Updating This File

Update this CLAUDE.md when:
- New major dependencies are added
- The project structure changes significantly
- New PopDB features or patterns are adopted
- The build or dev workflow changes
