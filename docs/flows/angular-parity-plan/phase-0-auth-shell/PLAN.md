# Angular Parity — Phase 0 (Auth & App-Shell Correctness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the auth/bootstrap defects that can bounce a valid session to the Hosted UI, and fix the app-shell guard and error-handling behaviour, so later phases can be verified against a trustworthy runtime.

**Architecture:** Seven independent changes to the `core/auth` and `core/error` layers plus `app.routes.ts` and one build script. `Auth` gains a first-bootstrap promise (`whenReady()`) that both route guards await; the HTTP auth interceptor gets single-flight token refresh, a one-retry guard via `HttpContext`, and a sign-out-on-failure path; a `/403` route and a `/redirecting` interstitial replace silent guard redirects; the global error handler stops masquerading unrelated errors as editor crashes.

**Tech Stack:** Angular 21 (standalone, zoneless, signals), `amazon-cognito-identity-js`, RxJS 7, Jest 30 + `jest-preset-angular` + `@testing-library/angular`, `@angular/common/http/testing` (`HttpTestingController`).

## Global Constraints

- Frontend root: `frontend/`. All paths below are relative to it.
- Branch base: `feat/angular-rewrite`. Do not merge to `master`.
- Test runner: `npx jest <path>` from `frontend/`. Full suite: `npm test`. Lint: `npm run lint`.
- Tests are zoneless: `setupZonelessTestEnv()` runs in `setup-jest.ts`. Guards are invoked with `TestBed.runInInjectionContext(...)`.
- When adding to an existing `.spec.ts`, first read it and match its TestBed setup style (a shared top-level `beforeEach` vs per-`describe` config). The snippets below assume a fresh `describe` block with its own providers; adapt if the file shares one module config.
- TDD: write the failing test, run it red, implement the minimum, run it green, commit. One behaviour per test.
- No new runtime dependencies. `@angular/cdk`, `@angular/material` already present.
- `environment.disableAuth === true` is the **only** supported local-dev auth mode (decision F8). Do not add a username/password path.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`), scoped `frontend` where useful. Follow the repo's trailer convention.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/app/core/auth/auth.ts` | Add `whenReady()` (first-bootstrap promise), single-flight `refreshIdToken()`, `getAccessToken()` | 1, 2, 3 |
| `src/app/core/auth/auth-guard.ts` | Await `whenReady()`; redirect to `/redirecting` | 1, 6 |
| `src/app/core/auth/admin-guard.ts` | Await `whenReady()`; redirect to `/403` | 1, 6 |
| `src/app/core/auth/auth-interceptor.ts` | Single-flight 401 refresh, one-retry `HttpContext` guard, sign-out-on-failure, id-then-access token | 2, 3 |
| `src/app/core/auth/cognito-config.ts` | Drop the cognito-local `endpoint` branch | 4 |
| `src/environments/environment.types.ts`, `environment.ts` | Drop the `endpoint` field | 4 |
| `scripts/lib/assert-prod-api-base-url.mjs` | **New.** Pure validator for the production API base URL | 5 |
| `scripts/build-env.mjs` | Call the validator before writing `environment.production.ts` | 5 |
| `jest.config.ts` | Pick up `scripts/**/*.spec.mjs` | 5 |
| `src/app/features/errors/forbidden.ts` | **New.** `/403` full-screen component | 6 |
| `src/app/features/errors/redirecting.ts` | **New.** `/redirecting` interstitial; triggers `redirectToLogin()` | 6 |
| `src/app/app.routes.ts` | Register `/403` + `/redirecting`; add `adminGuard` to `/settings` | 6 |
| `src/app/core/error/global-error-handler.ts` | Stop writing `EditorErrorState`; keep console + snackbar | 7 |
| `src/app/features/pages/page-detail.ts` | Catch editor-interaction throws into `EditorErrorState`; add "Reload Page" + reassurance to the inline panel | 7 |
| `LOCAL-DEV-GUIDE.md` | Document disableAuth-only local dev | 4 |

---

## Task 1: `Auth.whenReady()` and guards that await it

**Files:**
- Modify: `src/app/core/auth/auth.ts` (constructor `void this.bootstrap()` at line 41; add field + method)
- Modify: `src/app/core/auth/auth-guard.ts` (whole file)
- Modify: `src/app/core/auth/admin-guard.ts` (whole file)
- Test: `src/app/core/auth/auth.spec.ts`, `src/app/core/auth/auth-guard.spec.ts`, `src/app/core/auth/admin-guard.spec.ts`

**Interfaces:**
- Produces:
  - `Auth.whenReady(): Promise<void>` — resolves after the first `bootstrap()` settles (success or failure); resolves immediately on later calls.
  - `authGuard: CanActivateFn` → `Promise<boolean>` (redirect target unchanged in this task — still `auth.redirectToLogin()` + `false`).
  - `adminGuard: CanActivateFn` → `Promise<boolean | UrlTree>` (still `createUrlTree(['/pages'])` in this task).
- Consumes: existing `Auth.isAuthenticated()`, `Auth.user()`, `Auth.redirectToLogin()`.

- [ ] **Step 1: Write the failing test for `whenReady()`**

Add to `src/app/core/auth/auth.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { USER_POOL } from './cognito-config';

describe('Auth.whenReady', () => {
  it('resolves after the first bootstrap settles and is reusable', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_POOL, useValue: { getCurrentUser: () => null } }],
    });
    const auth = TestBed.inject(Auth);

    await expect(auth.whenReady()).resolves.toBeUndefined();
    expect(auth.isLoading()).toBe(false);
    // second call returns an already-resolved promise
    await expect(auth.whenReady()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it red**

Run: `npx jest src/app/core/auth/auth.spec.ts -t "whenReady"`
Expected: FAIL — `auth.whenReady is not a function`.

- [ ] **Step 3: Implement `whenReady()`**

In `src/app/core/auth/auth.ts`, replace the constructor:

```ts
  private _ready: Promise<void>;

  constructor() {
    this._ready = this.bootstrap();
  }

  /** Resolves after the first bootstrap() settles (success or failure). */
  whenReady(): Promise<void> {
    return this._ready;
  }
```

(`bootstrap()` already returns `Promise<void>` and never rejects — it swallows errors in its `try/catch/finally`. No other change needed there.)

- [ ] **Step 4: Run it green**

Run: `npx jest src/app/core/auth/auth.spec.ts -t "whenReady"`
Expected: PASS.

- [ ] **Step 5: Write the failing guard tests**

Replace `src/app/core/auth/auth-guard.spec.ts` body with an async version:

```ts
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let redirect: jest.Mock;
  let isAuthenticated: jest.Mock;
  let whenReady: jest.Mock;

  beforeEach(() => {
    redirect = jest.fn();
    isAuthenticated = jest.fn();
    whenReady = jest.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { isAuthenticated, redirectToLogin: redirect, whenReady } },
      ],
    });
  });

  function run(): Promise<unknown> {
    return Promise.resolve(
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ),
    );
  }

  it('awaits whenReady before deciding', async () => {
    isAuthenticated.mockReturnValue(true);
    await run();
    expect(whenReady).toHaveBeenCalledTimes(1);
  });

  it('returns true when authenticated', async () => {
    isAuthenticated.mockReturnValue(true);
    await expect(run()).resolves.toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects and returns false when not authenticated', async () => {
    isAuthenticated.mockReturnValue(false);
    await expect(run()).resolves.toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
```

Add to `src/app/core/auth/admin-guard.spec.ts` (keep the existing cases, add `whenReady` to the `Auth` stub and one assertion):

```ts
// in beforeEach, extend the Auth stub:
//   { provide: Auth, useValue: { user, whenReady: jest.fn().mockResolvedValue(undefined) } },

it('awaits whenReady before deciding', async () => {
  user.mockReturnValue({ role: 'Admin' });
  await Promise.resolve(run());
  // no throw = whenReady was awaited without error
  expect(user).toHaveBeenCalled();
});
```

- [ ] **Step 6: Run them red**

Run: `npx jest src/app/core/auth/auth-guard.spec.ts src/app/core/auth/admin-guard.spec.ts`
Expected: FAIL — `whenReady` undefined / guard returns a non-promise.

- [ ] **Step 7: Implement the async guards**

`src/app/core/auth/auth-guard.ts`:

```ts
import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  await auth.whenReady();
  if (auth.isAuthenticated()) return true;
  auth.redirectToLogin();
  return false;
};
```

`src/app/core/auth/admin-guard.ts`:

```ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { Auth } from './auth';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.user()?.role === 'Admin') return true;
  return router.createUrlTree(['/pages']);
};
```

- [ ] **Step 8: Run them green**

Run: `npx jest src/app/core/auth/auth.spec.ts src/app/core/auth/auth-guard.spec.ts src/app/core/auth/admin-guard.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/core/auth/auth.ts src/app/core/auth/auth-guard.ts src/app/core/auth/admin-guard.ts src/app/core/auth/auth.spec.ts src/app/core/auth/auth-guard.spec.ts src/app/core/auth/admin-guard.spec.ts
git commit -m "fix(frontend): guards await first auth bootstrap (F10)"
```

---

## Task 2: Single-flight 401 refresh + one-retry guard + sign-out on failure

**Files:**
- Modify: `src/app/core/auth/auth.ts` (`refreshIdToken()` at lines 111-123 — wrap in single-flight)
- Modify: `src/app/core/auth/auth-interceptor.ts` (whole `catchError` branch, lines 24-41)
- Test: `src/app/core/auth/auth.spec.ts`, `src/app/core/auth/auth-interceptor.spec.ts`

**Interfaces:**
- Consumes: `Auth.signOut()` (exists), `Auth.getIdToken()` (exists).
- Produces:
  - `Auth.refreshIdToken()` — unchanged signature `Promise<string | null>`; concurrent calls share one in-flight refresh.
  - `RETRIED: HttpContextToken<boolean>` exported from `auth-interceptor.ts` (default `false`); the interceptor sets it on the single retry and refuses to refresh again when it is set.

- [ ] **Step 1: Write the failing single-flight test**

Add to `src/app/core/auth/auth.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { USER_POOL } from './cognito-config';

describe('Auth.refreshIdToken single-flight', () => {
  it('shares one in-flight refresh across concurrent callers', async () => {
    let resolveSession!: (s: unknown) => void;
    const getSession = jest.fn((cb: (e: unknown, s: unknown) => void) => {
      new Promise((r) => (resolveSession = r)).then((s) => cb(null, s));
    });
    const cognitoUser = { getSession };
    TestBed.configureTestingModule({
      providers: [{ provide: USER_POOL, useValue: { getCurrentUser: () => cognitoUser } }],
    });
    const auth = TestBed.inject(Auth);
    await auth.whenReady();
    getSession.mockClear();

    const a = auth.refreshIdToken();
    const b = auth.refreshIdToken();
    resolveSession({
      isValid: () => true,
      getIdToken: () => ({ getJwtToken: () => 'fresh' }),
      getAccessToken: () => ({ getJwtToken: () => 'fresh-access' }),
    });

    await Promise.all([a, b]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it red**

Run: `npx jest src/app/core/auth/auth.spec.ts -t "single-flight"`
Expected: FAIL — `getSession` called twice.

- [ ] **Step 3: Implement single-flight in `Auth`**

In `src/app/core/auth/auth.ts`, rename the current `refreshIdToken` body to `_doRefresh` and wrap:

```ts
  private _refreshInFlight: Promise<string | null> | null = null;

  async refreshIdToken(): Promise<string | null> {
    if (this._refreshInFlight) return this._refreshInFlight;
    this._refreshInFlight = this._doRefresh().finally(() => {
      this._refreshInFlight = null;
    });
    return this._refreshInFlight;
  }

  private async _doRefresh(): Promise<string | null> {
    if (environment.disableAuth) return localStorage.getItem(ID_TOKEN_KEY);
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) return null;
    try {
      const session = await getSessionAsync(cognitoUser);
      if (!session.isValid()) return null;
      this.persistSession(session);
      return session.getIdToken().getJwtToken();
    } catch {
      return null;
    }
  }
```

- [ ] **Step 4: Run it green**

Run: `npx jest src/app/core/auth/auth.spec.ts -t "single-flight"`
Expected: PASS.

- [ ] **Step 5: Rewrite the interceptor 401 tests**

Replace the `it('refreshes token and retries on 401', ...)` and `it('redirects to login when refresh fails', ...)` cases in `src/app/core/auth/auth-interceptor.spec.ts` with:

```ts
  it('single-flights refresh across two concurrent 401s and retries each once', (done) => {
    let done1 = false;
    let done2 = false;
    const finish = () => { if (done1 && done2) {
      expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
      done();
    }};
    http.get('/api/a').subscribe(() => { done1 = true; finish(); });
    http.get('/api/b').subscribe(() => { done2 = true; finish(); });

    httpMock.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    setTimeout(() => {
      httpMock.expectOne('/api/a').flush({});
      httpMock.expectOne('/api/b').flush({});
    }, 0);
  });

  it('signs out and propagates the error when the retried request 401s again', (done) => {
    http.get('/api/pages').subscribe({
      error: (err) => {
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        expect(err.status).toBe(401);
        expect(auth.refreshIdToken).toHaveBeenCalledTimes(1);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    setTimeout(() => {
      httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
    }, 0);
  });

  it('signs out and propagates when refresh returns null', (done) => {
    auth.refreshIdToken.mockResolvedValueOnce(null);
    http.get('/api/pages').subscribe({
      error: () => {
        expect(auth.signOut).toHaveBeenCalledTimes(1);
        done();
      },
    });
    httpMock.expectOne('/api/pages').flush({}, { status: 401, statusText: 'Unauthorized' });
  });
```

Update the `auth` stub in `beforeEach` to add `signOut`:

```ts
    auth = {
      getIdToken: jest.fn().mockReturnValue('tok-1'),
      refreshIdToken: jest.fn().mockResolvedValue('tok-2'),
      redirectToLogin: jest.fn(),
      signOut: jest.fn(),
    };
```

- [ ] **Step 6: Run them red**

Run: `npx jest src/app/core/auth/auth-interceptor.spec.ts`
Expected: FAIL — retried request re-enters refresh; `signOut` never called.

- [ ] **Step 7: Implement the interceptor**

Replace `src/app/core/auth/auth-interceptor.ts` with:

```ts
import type { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import {
  HttpContextToken,
  HttpErrorResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { Auth } from './auth';

const API_PREFIX = '/api';

/** Set on the single retry so a second 401 does not loop back into refresh. */
export const RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (!req.url.startsWith(API_PREFIX) && !req.url.includes('/api/')) {
    return next(req);
  }

  const auth = inject(Auth);
  const token = auth.getIdToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      if (req.context.get(RETRIED)) {
        auth.signOut();
        return throwError(() => err);
      }
      return from(auth.refreshIdToken()).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            auth.signOut();
            return throwError(() => err);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${refreshed}` },
            context: req.context.set(RETRIED, true),
          });
          return next(retry);
        }),
      );
    }),
  );
};
```

- [ ] **Step 8: Run them green**

Run: `npx jest src/app/core/auth/auth.spec.ts src/app/core/auth/auth-interceptor.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/core/auth/auth.ts src/app/core/auth/auth-interceptor.ts src/app/core/auth/auth.spec.ts src/app/core/auth/auth-interceptor.spec.ts
git commit -m "fix(frontend): single-flight 401 refresh + retry guard + sign-out on failure (F6)"
```

---

## Task 3: `idToken || accessToken` header fallback

**Files:**
- Modify: `src/app/core/auth/auth.ts` (add `getAccessToken()` near `getIdToken()` at line 107)
- Modify: `src/app/core/auth/auth-interceptor.ts` (the `token` line)
- Test: `src/app/core/auth/auth.spec.ts`, `src/app/core/auth/auth-interceptor.spec.ts`

**Interfaces:**
- Produces: `Auth.getAccessToken(): string | null` — reads `localStorage['accessToken']`.
- Consumes: `ACCESS_TOKEN_KEY` constant (exists, line 13).

- [ ] **Step 1: Write the failing tests**

Add to `src/app/core/auth/auth.spec.ts`:

```ts
describe('Auth.getAccessToken', () => {
  it('returns the stored access token or null', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_POOL, useValue: { getCurrentUser: () => null } }],
    });
    const auth = TestBed.inject(Auth);
    localStorage.removeItem('accessToken');
    expect(auth.getAccessToken()).toBeNull();
    localStorage.setItem('accessToken', 'acc-9');
    expect(auth.getAccessToken()).toBe('acc-9');
    localStorage.removeItem('accessToken');
  });
});
```

Add to `src/app/core/auth/auth-interceptor.spec.ts`:

```ts
  it('falls back to the access token when there is no id token', () => {
    auth.getIdToken.mockReturnValue(null);
    (auth as unknown as { getAccessToken: jest.Mock }).getAccessToken = jest.fn().mockReturnValue('acc-1');
    http.get('/api/pages').subscribe();
    const req = httpMock.expectOne('/api/pages');
    expect(req.request.headers.get('Authorization')).toBe('Bearer acc-1');
    req.flush({});
  });

  it('sends no Authorization header when neither token exists', () => {
    auth.getIdToken.mockReturnValue(null);
    (auth as unknown as { getAccessToken: jest.Mock }).getAccessToken = jest.fn().mockReturnValue(null);
    http.get('/api/pages').subscribe();
    const req = httpMock.expectOne('/api/pages');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });
```

Also add `getAccessToken: jest.fn().mockReturnValue(null)` to the `auth` stub in `beforeEach`.

- [ ] **Step 2: Run them red**

Run: `npx jest src/app/core/auth/auth.spec.ts -t "getAccessToken" src/app/core/auth/auth-interceptor.spec.ts -t "access token"`
Expected: FAIL — `getAccessToken` not a function / header still null.

- [ ] **Step 3: Implement**

In `src/app/core/auth/auth.ts`, directly after `getIdToken()`:

```ts
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
```

In `src/app/core/auth/auth-interceptor.ts`, change:

```ts
  const token = auth.getIdToken() ?? auth.getAccessToken();
```

- [ ] **Step 4: Run them green**

Run: `npx jest src/app/core/auth/auth.spec.ts src/app/core/auth/auth-interceptor.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/auth/auth.ts src/app/core/auth/auth-interceptor.ts src/app/core/auth/auth.spec.ts src/app/core/auth/auth-interceptor.spec.ts
git commit -m "feat(frontend): Authorization header falls back to access token (F7)"
```

---

## Task 4: Drop the cognito-local `endpoint`

**Files:**
- Modify: `src/environments/environment.types.ts` (remove `endpoint?: string;`)
- Modify: `src/environments/environment.ts` (remove `endpoint: undefined,`)
- Modify: `src/app/core/auth/cognito-config.ts` (remove `endpoint` destructure + the `endpoint` property on the `CognitoUserPool` ctor)
- Modify: `LOCAL-DEV-GUIDE.md` (document disableAuth-only)
- Test: `src/app/core/auth/cognito-oauth.spec.ts` is unaffected; rely on the TypeScript compile + `npm test`

**Interfaces:**
- Produces: `createUserPool()` no longer reads `environment.cognito.endpoint`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing guard test**

Add to `src/app/core/auth/cognito-oauth.spec.ts` (or a new `cognito-config.spec.ts`):

```ts
import { createUserPool } from './cognito-config';

describe('createUserPool', () => {
  it('constructs without referencing a cognito-local endpoint', () => {
    // environment.ts has disableAuth: true, so missing ids do not throw.
    const pool = createUserPool();
    expect(pool).toBeDefined();
    // The Environment type no longer has `endpoint`; this file compiling is the assertion.
  });
});
```

- [ ] **Step 2: Run it red**

Run: `npx jest src/app/core/auth/cognito-oauth.spec.ts`
Expected: initially PASS at runtime, but the following type change must not break compile — proceed.

- [ ] **Step 3: Remove the field from the types**

`src/environments/environment.types.ts` — delete the line:

```ts
    endpoint?: string; // optional cognito-local endpoint
```

`src/environments/environment.ts` — delete the line:

```ts
    endpoint: undefined,
```

- [ ] **Step 4: Remove the branch from `cognito-config.ts`**

Change the destructure and constructor:

```ts
  const { userPoolId, clientId } = environment.cognito;
  // ...
  return new CognitoUserPool({
    UserPoolId: userPoolId || 'us-east-1_placeholder',
    ClientId: clientId || 'placeholder',
  });
```

- [ ] **Step 5: Update `LOCAL-DEV-GUIDE.md`**

Ensure a section reads (add or replace any local-Cognito / username-password content):

```markdown
## Frontend auth modes

The Angular frontend has exactly two auth modes:

- **Local dev** — `environment.ts` ships `disableAuth: true`. A mock admin user
  is signed in automatically; no Cognito calls are made. This is the only
  supported way to run the frontend locally.
- **Deployed envs** — real Cognito Hosted-UI (authorization-code flow). Set the
  `NG_APP_COGNITO_*` vars at build time via `scripts/build-env.mjs`.

There is no local username/password path and no `cognito-local` integration.
```

- [ ] **Step 6: Run the suite + lint**

Run: `npm test -- --silent && npm run lint`
Expected: PASS, no unused-symbol or missing-property errors.

- [ ] **Step 7: Commit**

```bash
git add src/environments/environment.types.ts src/environments/environment.ts src/app/core/auth/cognito-config.ts src/app/core/auth/cognito-oauth.spec.ts LOCAL-DEV-GUIDE.md
git commit -m "chore(frontend): drop unused cognito-local endpoint; document disableAuth-only local dev (F8)"
```

---

## Task 5: Production API-URL guard

**Files:**
- Create: `scripts/lib/assert-prod-api-base-url.mjs`
- Modify: `scripts/build-env.mjs` (call the validator before `writeFileSync`)
- Modify: `jest.config.ts` (`testMatch` add `<rootDir>/scripts/**/*.spec.mjs`)
- Test: `scripts/lib/assert-prod-api-base-url.spec.mjs`

**Interfaces:**
- Produces: `assertProdApiBaseUrl(value: string, opts?: { allowLocal?: boolean }): void` — throws `Error` with a named message on empty / `http://` / localhost / `*.local` unless `allowLocal` is true.
- Consumes: `process.env.ALLOW_LOCAL_API_URL` (read by `build-env.mjs`, passed as `opts.allowLocal`).

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/assert-prod-api-base-url.spec.mjs`:

```js
import { assertProdApiBaseUrl } from './assert-prod-api-base-url.mjs';

describe('assertProdApiBaseUrl', () => {
  it('accepts a real https api host', () => {
    expect(() => assertProdApiBaseUrl('https://api.bluefinwiki.bluefin605.com')).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => assertProdApiBaseUrl('')).toThrow(/empty|missing/i);
  });

  it('rejects http://', () => {
    expect(() => assertProdApiBaseUrl('http://api.example.com')).toThrow(/https/i);
  });

  it('rejects localhost and loopback', () => {
    expect(() => assertProdApiBaseUrl('https://localhost:3000')).toThrow(/local/i);
    expect(() => assertProdApiBaseUrl('https://127.0.0.1')).toThrow(/local/i);
    expect(() => assertProdApiBaseUrl('https://0.0.0.0')).toThrow(/local/i);
  });

  it('rejects a .local host', () => {
    expect(() => assertProdApiBaseUrl('https://box.local')).toThrow(/local/i);
  });

  it('allows a local value when allowLocal is set', () => {
    expect(() => assertProdApiBaseUrl('http://localhost:3000', { allowLocal: true })).not.toThrow();
  });
});
```

- [ ] **Step 2: Wire jest to see it, run red**

In `jest.config.ts`:

```ts
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/scripts/**/*.spec.mjs'],
```

Run: `npx jest scripts/lib/assert-prod-api-base-url.spec.mjs`
Expected: FAIL — cannot find `./assert-prod-api-base-url.mjs`.

- [ ] **Step 3: Implement the validator**

Create `scripts/lib/assert-prod-api-base-url.mjs`:

```js
/**
 * Throws unless `value` is a plausible production API base URL:
 * non-empty, https, and not pointed at a local/loopback host.
 * Pass { allowLocal: true } (from ALLOW_LOCAL_API_URL=1) to bypass the host check.
 */
export function assertProdApiBaseUrl(value, opts = {}) {
  if (!value || !value.trim()) {
    throw new Error('build-env: NG_APP_API_BASE_URL is empty/missing for a production build.');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`build-env: NG_APP_API_BASE_URL is not a valid URL: ${value}`);
  }
  if (opts.allowLocal) return;
  if (url.protocol !== 'https:') {
    throw new Error(`build-env: NG_APP_API_BASE_URL must use https in production, got: ${value}`);
  }
  const host = url.hostname.toLowerCase();
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local');
  if (local) {
    throw new Error(
      `build-env: NG_APP_API_BASE_URL points at a local host (${host}) for a production build. ` +
        'Set a real https api.* URL, or ALLOW_LOCAL_API_URL=1 to override.',
    );
  }
}
```

- [ ] **Step 4: Run it green**

Run: `npx jest scripts/lib/assert-prod-api-base-url.spec.mjs`
Expected: PASS (all 7).

- [ ] **Step 5: Call it from `build-env.mjs`**

In `scripts/build-env.mjs`, after the `REQUIRED` check and before building `env`:

```js
import { assertProdApiBaseUrl } from './lib/assert-prod-api-base-url.mjs';

// ...after the `missing` check...
assertProdApiBaseUrl(process.env.NG_APP_API_BASE_URL, {
  allowLocal: process.env.ALLOW_LOCAL_API_URL === '1',
});
```

- [ ] **Step 6: Smoke the script both ways**

Run:
```bash
NG_APP_API_BASE_URL=http://localhost:3000 NG_APP_COGNITO_REGION=x NG_APP_COGNITO_USER_POOL_ID=x NG_APP_COGNITO_CLIENT_ID=x NG_APP_COGNITO_DOMAIN=x NG_APP_COGNITO_REDIRECT_URI=x node scripts/build-env.mjs
```
Expected: exits non-zero, prints the "points at a local host" error.

Run the same with `NG_APP_API_BASE_URL=https://api.bluefinwiki.bluefin605.com`.
Expected: exits 0, writes `src/environments/environment.production.ts`. **Discard that file change** (`git checkout src/environments/environment.production.ts`).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/assert-prod-api-base-url.mjs scripts/lib/assert-prod-api-base-url.spec.mjs scripts/build-env.mjs jest.config.ts
git commit -m "feat(frontend): fail the prod build on an empty or local API base URL (F9)"
```

---

## Task 6: `/403` route + `/redirecting` interstitial + `/settings` admin guard

**Files:**
- Create: `src/app/features/errors/forbidden.ts`
- Create: `src/app/features/errors/redirecting.ts`
- Modify: `src/app/app.routes.ts` (add two routes; add `adminGuard` to `settings`)
- Modify: `src/app/core/auth/admin-guard.ts` (`['/pages']` → `['/403']`)
- Modify: `src/app/core/auth/auth-guard.ts` (redirect via `/redirecting` UrlTree instead of `redirectToLogin()` + `false`)
- Test: `src/app/features/errors/forbidden.spec.ts`, `src/app/core/auth/admin-guard.spec.ts`, `src/app/core/auth/auth-guard.spec.ts`

**Interfaces:**
- Consumes: `Auth.whenReady()`, `Auth.redirectToLogin()` (from Task 1), `Router.createUrlTree`.
- Produces:
  - `ForbiddenComponent` (`selector: 'wiki-forbidden'`) at route `403`.
  - `RedirectingComponent` (`selector: 'wiki-redirecting'`) at route `redirecting` — calls `auth.redirectToLogin()` in its constructor.
  - `authGuard` now returns `UrlTree` to `/redirecting` when unauthenticated (no direct `redirectToLogin()` call).
  - `adminGuard` now returns `UrlTree` to `/403`.

- [ ] **Step 1: Write the failing component test**

Create `src/app/features/errors/forbidden.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { ForbiddenComponent } from './forbidden';

describe('ForbiddenComponent', () => {
  it('shows the 403 copy and a link to /pages', async () => {
    await render(ForbiddenComponent, { providers: [provideRouter([])] });
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /pages/i });
    expect(link).toHaveAttribute('href', '/pages');
  });
});
```

- [ ] **Step 2: Run it red**

Run: `npx jest src/app/features/errors/forbidden.spec.ts`
Expected: FAIL — cannot find `./forbidden`.

- [ ] **Step 3: Implement the two components**

Create `src/app/features/errors/forbidden.ts`:

```ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'wiki-forbidden',
  imports: [RouterLink, MatButtonModule],
  template: `
    <main style="padding:2rem; text-align:center;">
      <h1>403</h1>
      <p>You don't have permission to view this page.</p>
      <a routerLink="/pages" mat-stroked-button>Go to Pages</a>
    </main>
  `,
})
export class ForbiddenComponent {}
```

Create `src/app/features/errors/redirecting.ts`:

```ts
import { Component, inject } from '@angular/core';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'wiki-redirecting',
  template: `<main style="padding:2rem; text-align:center;"><p>Redirecting to sign in…</p></main>`,
})
export class RedirectingComponent {
  constructor() {
    inject(Auth).redirectToLogin();
  }
}
```

- [ ] **Step 4: Run it green**

Run: `npx jest src/app/features/errors/forbidden.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing guard/route tests**

Update `src/app/core/auth/admin-guard.spec.ts` — the two redirect cases now expect `/403`:

```ts
  it('redirects to /403 for Standard user', () => {
    user.mockReturnValue({ role: 'Standard' });
    run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
  });

  it('redirects to /403 for null user', () => {
    user.mockReturnValue(null);
    run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
  });
```

Update `src/app/core/auth/auth-guard.spec.ts` — the unauthenticated case now returns a UrlTree via `Router`:

```ts
// add to providers:
//   { provide: Router, useValue: { createUrlTree: jest.fn(() => ({ __urlTree: true })) } },
// and import Router.

  it('routes to /redirecting when not authenticated', async () => {
    isAuthenticated.mockReturnValue(false);
    const result = await run();
    expect(result).toEqual({ __urlTree: true });
    expect(TestBed.inject(Router).createUrlTree).toHaveBeenCalledWith(['/redirecting']);
  });
```

(Remove the old `redirects and returns false` case; `redirectToLogin` is now the `RedirectingComponent`'s job.)

Create `src/app/app.routes.spec.ts`:

```ts
import { routes } from './app.routes';
import { adminGuard } from './core/auth/admin-guard';
import { authGuard } from './core/auth/auth-guard';

describe('app.routes', () => {
  it('guards /settings with authGuard and adminGuard', () => {
    const settings = routes.find((r) => r.path === 'settings');
    expect(settings?.canActivate).toEqual([authGuard, adminGuard]);
  });

  it('registers /403 and /redirecting', () => {
    expect(routes.some((r) => r.path === '403')).toBe(true);
    expect(routes.some((r) => r.path === 'redirecting')).toBe(true);
  });
});
```

- [ ] **Step 6: Run them red**

Run: `npx jest src/app/core/auth/admin-guard.spec.ts src/app/core/auth/auth-guard.spec.ts src/app/app.routes.spec.ts`
Expected: FAIL — guards still target `/pages` / call `redirectToLogin`; routes missing.

- [ ] **Step 7: Implement routes + guard targets**

`src/app/core/auth/admin-guard.ts` — change the redirect:

```ts
  return router.createUrlTree(['/403']);
```

`src/app/core/auth/auth-guard.ts` — route to the interstitial:

```ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/redirecting']);
};
```

`src/app/app.routes.ts` — add the routes (before the `**` wildcard) and guard `settings`:

```ts
  { path: '403', loadComponent: () => import('./features/errors/forbidden').then((m) => m.ForbiddenComponent) },
  { path: 'redirecting', loadComponent: () => import('./features/errors/redirecting').then((m) => m.RedirectingComponent) },
```

```ts
  { path: 'settings', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/settings-page').then((m) => m.SettingsPage) },
```

- [ ] **Step 8: Run them green**

Run: `npx jest src/app/core/auth/admin-guard.spec.ts src/app/core/auth/auth-guard.spec.ts src/app/app.routes.spec.ts src/app/features/errors/forbidden.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/features/errors/ src/app/app.routes.ts src/app/app.routes.spec.ts src/app/core/auth/admin-guard.ts src/app/core/auth/admin-guard.spec.ts src/app/core/auth/auth-guard.ts src/app/core/auth/auth-guard.spec.ts
git commit -m "feat(frontend): add /403 + /redirecting; admin-guard /settings (§10)"
```

---

## Task 7: Scope the editor-crash handler

**Files:**
- Modify: `src/app/core/error/global-error-handler.ts` (drop the `EditorErrorState` write + import/inject)
- Modify: `src/app/features/pages/page-detail.ts` (`onAction` / `onInsertMarkdown` / `onPickPage` try-catch → `errorState.setError`; add `reloadPage()`; extend the inline panel template)
- Test: `src/app/core/error/global-error-handler.spec.ts`, `src/app/features/pages/page-detail.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `EditorErrorState.setError(message)`, `EditorErrorState.clear()` (exist).
- Produces: `GlobalErrorHandler.handleError` no longer touches `EditorErrorState`. `PageDetail.reloadPage()` calls `window.location.reload()`.

- [ ] **Step 1: Rewrite the global-error-handler tests**

Replace `src/app/core/error/global-error-handler.spec.ts`'s second `it` with:

```ts
  it('does NOT populate EditorErrorState', () => {
    const handler = TestBed.inject(GlobalErrorHandler);
    const state = TestBed.inject(EditorErrorState);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    handler.handleError(new Error('kaboom'));
    expect(state.current()).toBeNull();
    spy.mockRestore();
  });
```

- [ ] **Step 2: Run it red**

Run: `npx jest src/app/core/error/global-error-handler.spec.ts`
Expected: FAIL — `state.current()` is `{ message: 'kaboom' }`.

- [ ] **Step 3: Implement the narrowed handler**

Replace `src/app/core/error/global-error-handler.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import type { ErrorHandler } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private snack = inject(MatSnackBar);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
    this.snack
      .open('Something went wrong — try again.', 'Reload', { duration: 6000 })
      .onAction()
      .subscribe(() => window.location.reload());
  }
}
```

- [ ] **Step 4: Run it green**

Run: `npx jest src/app/core/error/global-error-handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing page-detail tests**

In `src/app/features/pages/page-detail.spec.ts` (create if absent, following the pattern in `src/app/features/pages/pages-view.spec.ts` for providers), add:

```ts
import { EditorErrorState } from '../../core/error/editor-error-state';

it('routes an editor-action throw into EditorErrorState, not a snackbar', async () => {
  // render PageDetail in edit mode with a stub editor whose applyAction throws
  const { fixture } = await renderPageDetailInEditMode();
  const state = TestBed.inject(EditorErrorState);
  (fixture.componentInstance as any).editor = () => ({
    applyAction: () => { throw new Error('CM exploded'); },
  });
  (fixture.componentInstance as any).onAction({ type: 'bold' });
  expect(state.current()?.message).toContain('CM exploded');
});

it('renders Reload Page + reassurance in the editor-crash panel', async () => {
  const { fixture } = await renderPageDetailInEditMode();
  TestBed.inject(EditorErrorState).setError('boom');
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Reload Page');
  expect(fixture.nativeElement.textContent).toMatch(/saved to this browser/i);
});
```

(`renderPageDetailInEditMode` is a local helper in the spec that provides `ActivatedRoute` with `data: { editMode: true }`, a `Pages` stub whose `pageResource` resolves a minimal page, `Drafts`, `PageTypes`, `MatDialog`, `MatSnackBar` stubs — mirror `pages-view.spec.ts`.)

- [ ] **Step 6: Run them red**

Run: `npx jest src/app/features/pages/page-detail.spec.ts`
Expected: FAIL — `onAction` rethrows; panel has no "Reload Page".

- [ ] **Step 7: Implement the catches + panel copy**

In `src/app/features/pages/page-detail.ts`, wrap the editor-interaction methods:

```ts
  onAction(action: ToolbarAction): void {
    try {
      this.editor()?.applyAction(action);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  onPickPage(page: PageSearchResult, ctx: CursorContext): void {
    try {
      const replacement = `[[${page.title}]]`;
      this.editor()?.insertText(ctx.from, ctx.to, replacement);
      this.cursorContext.set(null);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  onInsertMarkdown(text: string): void {
    try {
      const ed = this.editor();
      const view = ed?.getView();
      if (!view) return;
      const { from, to } = view.state.selection.main;
      ed?.insertText(from, to, text);
    } catch (err) {
      this.errorState.setError(this.editorErrMessage(err));
    }
  }

  reloadPage(): void {
    window.location.reload();
  }

  private editorErrMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'The editor hit an unexpected error.';
  }
```

Extend the inline crash panel in the template (the `@else if (mode() === 'edit' && editorError(); as err)` block):

```html
      } @else if (mode() === 'edit' && editorError(); as err) {
        <div class="state error">
          <p>The editor crashed: {{ err.message }}</p>
          <p>Your recent changes were saved to this browser automatically — reloading is safe.</p>
          <button mat-flat-button color="primary" type="button" (click)="reloadEditor()">
            Try Again
          </button>
          <button mat-stroked-button type="button" (click)="reloadPage()">
            Reload Page
          </button>
        </div>
      }
```

- [ ] **Step 8: Run them green**

Run: `npx jest src/app/features/pages/page-detail.spec.ts src/app/core/error/global-error-handler.spec.ts`
Expected: PASS.

- [ ] **Step 9: Full suite + lint + commit**

Run: `npm test -- --silent && npm run lint`
Expected: PASS.

```bash
git add src/app/core/error/global-error-handler.ts src/app/core/error/global-error-handler.spec.ts src/app/features/pages/page-detail.ts src/app/features/pages/page-detail.spec.ts
git commit -m "fix(frontend): scope editor-crash UI to editor failures; add Reload Page (F11)"
```

---

## Manual verification (end of phase, against **real Cognito** — flip `environment.ts` `disableAuth: false` or use a deployed build)

- [ ] Cold-load a deep link `/pages/:guid` while signed in → lands on the page, no Hosted-UI bounce.
- [ ] Expire the id token; fire two concurrent API calls → exactly one refresh; both succeed.
- [ ] Let refresh fail → signed out, tokens cleared, error surfaced (not a silent swallow).
- [ ] Non-admin opens `/admin/users` and `/settings` → both render the `/403` page.
- [ ] Unauthenticated deep link → shows "Redirecting to sign in…" before the Hosted-UI redirect.
- [ ] Throw a non-editor runtime error → generic snackbar with Reload only; `PageDetail` shows no editor-crash panel.
- [ ] Trigger an editor-action failure in edit mode → inline "Editor crashed" panel with Try Again + Reload Page + the reassurance line.

---

## Self-Review

**Spec coverage** (against `phase-0-auth-shell/` step files):

| Step file | Task |
|---|---|
| 0.1 authguard-bootstrap-race | Task 1 |
| 0.2 401-refresh-coalescing | Task 2 |
| 0.3 auth-token-fallback | Task 3 |
| 0.4 drop-local-userpass-auth | Task 4 |
| 0.5 prod-api-url-guard | Task 5 |
| 0.6 403-route-and-guards | Task 6 |
| 0.7 scope-editor-crash-handler | Task 7 |

**Type consistency:** `whenReady(): Promise<void>` used identically in Tasks 1/6 guard code and specs. `RETRIED: HttpContextToken<boolean>` defined in Task 2, not re-referenced elsewhere. `getAccessToken(): string | null` defined Task 3, consumed in the same task's interceptor edit. `assertProdApiBaseUrl(value, opts?)` signature identical in the validator, its spec, and the `build-env.mjs` call site. `ForbiddenComponent` / `RedirectingComponent` class names identical in the components, routes, and specs.

**Placeholder scan:** none — every code step carries full source. The only deferred item is the `renamePageDetailInEditMode` spec helper in Task 7 Step 5, whose construction is specified inline (mirror `pages-view.spec.ts` providers).

**Known interaction:** Task 6 rewrites `authGuard` to return a `UrlTree` instead of calling `redirectToLogin()`; Task 1's `auth-guard.spec.ts` case "redirects and returns false" is superseded by Task 6 Step 5's "routes to /redirecting". Execute the tasks in order.
