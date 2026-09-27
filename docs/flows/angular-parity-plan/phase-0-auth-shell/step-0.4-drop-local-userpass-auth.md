# Step 0.4 — Drop local username/password auth; document disableAuth-only

| | |
|---|---|
| Phase | 0 — Auth & app-shell correctness |
| Gap refs | F8; punch list 🟠 "no local-dev username/password auth path" |
| Impact | 🟠 (resolved: **drop**, do not port) |
| Depends on | none |
| Parallel-safe | yes |
| Est. size | S |

## Problem

React had `USER_PASSWORD_AUTH` against `cognito-local` plus app-client
auto-discovery (`ListUserPools` / `ListUserPoolClients`), on top of the
`VITE_DISABLE_AUTH` bypass. Angular has only the `disableAuth` mock-admin bypass
and real Hosted-UI. `environment.cognito.endpoint` (cognito-local) is **typed
but never used**.

**Decision:** do not port the username/password path. Local dev =
`disableAuth: true`. Remove the dead typing and document it.

## Target behaviour

- No `cognito.endpoint` / cognito-local references anywhere in the frontend.
- `LOCAL-DEV-GUIDE.md` states plainly: the Angular frontend has two auth modes —
  `disableAuth: true` (local dev, mock admin) and real Cognito Hosted-UI
  (deployed envs). There is no local username/password flow.

## Implementation notes

**Files:** `src/environments/*.ts`, `core/auth/cognito-config.ts`,
`core/auth/auth.types.ts` (if `endpoint` is in a type), `LOCAL-DEV-GUIDE.md`

- `grep -rn "endpoint" src/environments src/app/core/auth` to find every
  reference; remove the field from the environment type and all env files.
- If `USER_POOL` / `cognito-config.ts` reads `endpoint`, drop that branch.
- Verify `npm run build` and `npm test` still pass with the field gone.
- `LOCAL-DEV-GUIDE.md`: replace/trim any section describing local Cognito or
  username/password login with the two-mode statement above.

## Tests first (TDD)

- Mostly a deletion — the guard is the compiler + existing suites.
- If `cognito-config.spec.ts` exists, update it to assert no `endpoint` usage.
- Add/confirm a test that `disableAuth: true` still yields the mock admin.

## Acceptance criteria

- [ ] Zero references to `cognito.endpoint` / cognito-local in `frontend/`.
- [ ] `LOCAL-DEV-GUIDE.md` documents disableAuth-only local dev.
- [ ] `npm test` + `npm run build` green.

## Out of scope

- Any change to the `disableAuth` mock-admin behaviour itself.
