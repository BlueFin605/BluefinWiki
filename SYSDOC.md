# BlueFinWiki

Purpose: a private, serverless family wiki with a built-in Kanban board system. See the root [README.md](README.md) for the full feature list, cost model, and getting-started steps.

## Tech stack

- Frontend: Angular 21 + Angular Material + TypeScript (see `frontend/SYSDOC.md`)
- Backend: AWS Lambda handlers, Node.js 20 + TypeScript, run locally via an Express wrapper (see `backend/SYSDOC.md`)
- Infrastructure: AWS CDK, C# (see `infrastructure/SYSDOC.md`)
- Local orchestration: Microsoft Aspire (see `aspire/SYSDOC.md`)
- E2E: Playwright (see `e2e/SYSDOC.md`)

## Where things are

- `frontend/` — Angular SPA. See `frontend/SYSDOC.md`.
- `backend/` — Lambda function handlers (auth, pages, storage, search, tags, page-types, MCP server). See `backend/SYSDOC.md`.
- `infrastructure/` — AWS CDK app (single Unified Stack). See `infrastructure/SYSDOC.md`.
- `aspire/` — local dev orchestration (AppHost). See `aspire/SYSDOC.md`.
- `e2e/` — Playwright suite against the running dev stack. See `e2e/SYSDOC.md`.
- `docs/flows/angular-parity-plan/` — project-plan docs for the React→Angular migration, not architecture docs.

## Running it

Quickstart and deploy steps are in the root README and in `QUICKSTART.md` / `DEPLOY-AWS.md` — not repeated here.

One thing not spelled out elsewhere: the Aspire AppHost (`aspire/BlueFinWiki.AppHost/Program.cs`) is the single source of truth for how the whole local stack is wired together — it starts LocalStack, Cognito Local, and MailHog as containers, then launches `backend` (`npm run dev`, port 3000) and `frontend` (`npm start` → `ng serve`, port 5173) as JS apps via `AddJavaScriptApp`, wiring the frontend's `NG_APP_API_BASE_URL` to the backend's port and the backend's AWS/Cognito env vars to the emulated endpoints. There's no separate docker-compose or proxy config to hunt down — `Program.cs` is the whole picture, and `aspire/SYSDOC.md` covers the per-service detail.
