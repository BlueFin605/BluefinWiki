# Phase 0 — Auth & app-shell correctness

**Goal:** eliminate the auth/bootstrap defects that can bounce a valid session,
and fix the app-shell error and guard behaviour. This is the highest regression
risk and it blocks confident runtime testing of every later phase.

**Depends on:** nothing. Do this first.

**Blocks:** step 0.6 (`/403` route) is a prerequisite for Phase 8 back-nav /
guard work. The rest of Phase 0 unblocks reliable manual verification everywhere.

## Steps

Run in this order. 0.1, 0.4, 0.5 are parallel-safe. 0.2 and 0.3 both edit
`auth.ts` + `auth-interceptor.ts` — do 0.2 then 0.3. 0.6 touches
`app.routes.ts` + guards (sequence after 0.1). 0.7 touches error handling.

| # | Step | Impact | Files |
|---|---|---|---|
| 0.1 | [authGuard bootstrap race](step-0.1-authguard-bootstrap-race.md) | 🔴 | `core/auth/auth-guard.ts`, `core/auth/auth.ts` |
| 0.2 | [401 refresh single-flight + retry guard](step-0.2-401-refresh-coalescing.md) | 🟠 | `core/auth/auth-interceptor.ts`, `core/auth/auth.ts` |
| 0.3 | [Auth token fallback](step-0.3-auth-token-fallback.md) | ⚪→do | `core/auth/auth.ts`, `core/auth/auth-interceptor.ts` |
| 0.4 | [Drop local username/password auth](step-0.4-drop-local-userpass-auth.md) | 🟠 | `environments/*`, `core/auth/cognito-config.ts`, `LOCAL-DEV-GUIDE.md` |
| 0.5 | [Prod API-URL guard](step-0.5-prod-api-url-guard.md) | 🟠 | `scripts/build-env.mjs` |
| 0.6 | [/403 route + admin guards](step-0.6-403-route-and-guards.md) | 🟠 | `app.routes.ts`, `core/auth/admin-guard.ts`, `core/auth/auth-guard.ts`, new `features/errors/forbidden.ts` |
| 0.7 | [Scope the editor-crash handler](step-0.7-scope-editor-crash-handler.md) | 🟠 | `core/error/global-error-handler.ts`, `core/error/editor-error-state.ts`, `features/pages/page-detail.ts` |

## Phase exit criteria

- [ ] Every step's acceptance criteria met.
- [ ] `npm test` green, `npm run lint` clean in `frontend/`.
- [ ] Manual, against **real Cognito** (not `disableAuth`): cold-load a deep link
      (`/pages/:guid`) while signed in — lands on the page, no Hosted-UI bounce.
- [ ] Manual: expire the id token, trigger two concurrent API calls — exactly one
      refresh fires, both requests succeed.
- [ ] Manual: non-admin hits `/admin/users` and `/settings` — both show the `/403`
      page, not a silent redirect.
- [ ] Manual: throw a non-editor error at runtime — generic snackbar only, no
      "editor crashed" panel on `PageDetail`.
