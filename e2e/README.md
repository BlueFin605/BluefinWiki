# BluefinWiki E2E (Playwright)

Real-browser Playwright suite covering Phase 1b's 32-item responsive/layout
manual-QA matrix — see
`docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md` for how it was
built and `docs/superpowers/specs/2026-09-19-phase-1b-playwright-e2e-design.md`
for the design.

## Prerequisites

The Aspire dev stack must already be running (frontend on `:5173`, backend on
`:3000`) — see the root [`LOCAL-DEV-GUIDE.md`](../LOCAL-DEV-GUIDE.md) for how
to start it. This suite has no `webServer` auto-start: it assumes the stack
is already up, per the approved design spec.

## Install

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npx playwright test                          # full suite
npx playwright test tree-drawer.spec.ts       # one file
npx tsc --noEmit                              # typecheck only
```

## Why no `webServer`

Tests hit the already-running dev stack directly (`baseURL: 'http://localhost:5173'`
in `playwright.config.ts`) and seed/tear down their own fixture pages via the
backend API. Auto-starting the stack from Playwright's config would duplicate
what Aspire already does and add a second, competing lifecycle to manage.
