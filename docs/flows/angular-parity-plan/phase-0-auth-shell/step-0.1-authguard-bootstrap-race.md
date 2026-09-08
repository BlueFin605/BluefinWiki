# Step 0.1 — authGuard bootstrap race

| | |
|---|---|
| Phase | 0 — Auth & app-shell correctness |
| Gap refs | F10; §10 "Redirecting to sign in…"; punch list 🔴 #17 |
| Impact | 🔴 Functional |
| Depends on | none |
| Parallel-safe | yes (with 0.2–0.5) |
| Est. size | M |

## Problem

`Auth.bootstrap()` (`core/auth/auth.ts:44`) is async and sets `_isLoading` to
`false` only in its `finally`. `authGuard` (`core/auth/auth-guard.ts`) checks
`auth.isAuthenticated()` **synchronously** — which is `_user() !== null`. On a
cold load or a deep link (`/pages/:guid`), the guard can run before
`getSession()` resolves, see `_user() === null`, and redirect a validly
signed-in user to the Hosted UI. `disableAuth: true` masks this in dev because
bootstrap sets the user synchronously.

## Target behaviour

- `authGuard` waits for the **first** bootstrap result before deciding.
- If bootstrap resolves with a user → allow.
- If bootstrap resolves with no user → `redirectToLogin()` and block.
- Subsequent navigations (bootstrap already settled) resolve synchronously —
  no added latency.
- React parity: nothing renders while loading; redirect only once loading
  settles (`AuthGate`).

## Implementation notes

**Files:** `core/auth/auth.ts`, `core/auth/auth-guard.ts`

- Expose a `whenReady(): Promise<void>` (or `ready` signal / `firstValueFrom`
  of an observable) on `Auth` that resolves when the first `bootstrap()` call
  completes (success or failure). Store the bootstrap promise in the
  constructor instead of `void this.bootstrap()`.
- `authGuard` becomes `async` / returns a `Promise<boolean | UrlTree>`:
  `await auth.whenReady()`, then the existing check.
- Keep the redirect path consistent with [step 0.6](step-0.6-403-route-and-guards.md):
  return `false` after `redirectToLogin()` (or a `UrlTree` to an interstitial —
  see 0.6). Do not change the redirect target in this step; 0.6 owns that.
- `adminGuard` should `await auth.whenReady()` too (it has the same latent race).

## Tests first (TDD)

- `auth-guard.spec.ts`: bootstrap pending → guard promise unresolved; bootstrap
  resolves with a user → guard resolves `true`; bootstrap resolves with no user
  → `redirectToLogin` called, guard resolves `false`.
- `auth.spec.ts`: `whenReady()` resolves after `bootstrap()` finally block;
  resolves immediately on a second call.
- Regression: deep-link navigation with a valid stored session does **not**
  call `redirectToLogin`.

## Acceptance criteria

- [ ] `authGuard` and `adminGuard` await the first bootstrap result.
- [ ] Cold-load `/pages/:guid` with a valid real-Cognito session lands on the
      page (manual verification against real Cognito, recorded in the PR).
- [ ] No regression in `disableAuth: true` dev flow.
- [ ] New tests cover pending / user / no-user.

## Out of scope

- The interstitial "Redirecting to sign in…" screen and redirect-target change
  (→ step 0.6).
- Token refresh behaviour (→ step 0.2).
