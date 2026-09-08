# Step 0.2 — 401 refresh single-flight + retry guard + failure path

| | |
|---|---|
| Phase | 0 — Auth & app-shell correctness |
| Gap refs | F6; punch list 🟠 "401 refresh" |
| Impact | 🟠 UX / guard |
| Depends on | none (coordinate with 0.1 on `Auth` surface) |
| Parallel-safe | yes |
| Est. size | M |

## Problem

`auth-interceptor.ts` refreshes on 401 and retries once, but:

- **No single-flight coalescing** — there is an explicit `TODO` at line 26.
  Concurrent 401s each call `auth.refreshIdToken()` in parallel.
- **No `_retried` guard** — a retried request that 401s again re-enters the
  refresh branch.
- **Wrong failure path** — on refresh failure it calls `auth.redirectToLogin()`.
  React calls `signOut()` (clears tokens) then rejects.

## Target behaviour (React parity)

- Concurrent 401s share **one** in-flight `refreshIdToken()` promise.
- The original request is retried **at most once** (`_retried` guard).
- If the retry still 401s, or refresh returns null → `auth.signOut()` and
  propagate the error (reject), do **not** silently swallow with `EMPTY`.

## Implementation notes

**Files:** `core/auth/auth.ts`, `core/auth/auth-interceptor.ts`

- On `Auth`: add a private `_refreshInFlight: Promise<string | null> | null`.
  Wrap `refreshIdToken()` so callers during an in-flight refresh await the same
  promise; clear it in a `finally`. Keep the raw refresh logic in a private
  method.
- Interceptor: add a context token or a header marker (`X-Retried`, stripped
  before send) — or clone-with-a-symbol via `HttpContext` — to mark a request
  as already retried. `HttpContext` is the clean option.
- Failure branch: replace `auth.redirectToLogin(); return EMPTY;` with
  `auth.signOut(); return throwError(() => err);`.
- Leave the non-`/api` early return and the `Authorization` header logic alone
  except where [step 0.3](step-0.3-auth-token-fallback.md) changes it.

## Tests first (TDD)

- `auth-interceptor.spec.ts` (HttpTestingController):
  - Two simultaneous requests both 401 → `refreshIdToken` invoked **once** →
    both retried with the new token → both succeed.
  - Retried request 401s again → `signOut` called, error propagates, no second
    refresh.
  - `refreshIdToken` resolves null → `signOut` called, error propagates.
  - Non-401 error → passes through untouched.
- `auth.spec.ts`: overlapping `refreshIdToken()` calls resolve from one
  underlying refresh; a later call after settle starts a fresh refresh.

## Acceptance criteria

- [ ] Single-flight: N concurrent 401s → 1 refresh.
- [ ] `_retried` guard prevents infinite refresh loops.
- [ ] Failure path = `signOut()` + reject (tokens cleared).
- [ ] `TODO` at `auth-interceptor.ts:26` removed.
- [ ] Tests cover concurrency, retry-once, and both failure modes.

## Out of scope

- `idToken || accessToken` header fallback (→ step 0.3).
- Guard timing (→ step 0.1).
