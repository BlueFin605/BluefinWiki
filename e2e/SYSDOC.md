# E2E — BlueFinWiki

What this is: a real-browser Playwright suite (42 spec files) covering the Angular frontend end to end — boards, editor, admin, invitations, AI features, page tree, etc. Runs against an already-running Aspire dev stack rather than starting its own (see `e2e/README.md`'s "Why no webServer" section) and seeds/tears down its own fixture data via the backend API.

Built with: Playwright + TypeScript.

Not folded into `../aspire/SYSDOC.md` or `../backend/SYSDOC.md` because it's a separate concern with its own tooling/lifecycle (a test suite that exercises both areas together, owned by neither).

## Where things are

- `tests/` — one spec file per feature/flow.
- `fixtures/` — shared fixture setup: `admin-users.ts`, `ai.ts`, `api.ts`, `bulk-pages.ts`, `page-tree.ts`, `page-types.ts`.
- `playwright.config.ts` — `baseURL` (`http://localhost:5173`) and other run config.

## Running / using this area

Fully covered by `e2e/README.md` (prerequisites, install, run commands) — not repeated here.
