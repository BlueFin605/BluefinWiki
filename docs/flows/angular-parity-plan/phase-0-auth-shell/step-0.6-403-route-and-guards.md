# Step 0.6 — /403 route + admin guards + sign-in interstitial

| | |
|---|---|
| Phase | 0 — Auth & app-shell correctness |
| Gap refs | §0.1 route map; §4 route guard; §10 "403" + "Redirecting to sign in…"; punch list 🟠 "/settings not admin-guarded; no 403 page" |
| Impact | 🟠 |
| Depends on | 0.1 (guard timing) — sequence after it |
| Est. size | M |

## Problem

- `/settings` uses `authGuard` only. Any authenticated user can open it; they
  just see fewer tiles. React gave non-admins a **403 page**
  (`PermissionGuard requiredRole="Admin"`).
- `adminGuard` on `/admin/*` **redirects to `/pages`** instead of showing a 403.
- There is no `/403` route/component.
- `authGuard` returning `false` shows no interstitial while the Hosted-UI
  redirect runs (React showed "Redirecting to sign in…").

## Target behaviour

- New `/403` route → a `ForbiddenComponent`: full-screen "403 / You don't have
  permission to view this page. / Go to Pages" (link to `/pages`). Chrome-less
  or under the shell — match how `NotFound` renders today.
- `adminGuard`: on failure return `createUrlTree(['/403'])` (not `/pages`).
- `/settings`: add `adminGuard` alongside `authGuard`.
- `authGuard`: while redirecting to Hosted UI, route to a lightweight
  `/redirecting` interstitial (or render "Redirecting to sign in…" inline)
  rather than a blank block. Keep it minimal.
- Keep `shared/components/permission.ts` (the `*appPermission` role check for
  hiding tiles/menu items) — it is complementary, not a replacement.

## Implementation notes

**Files:** `app.routes.ts`, `core/auth/admin-guard.ts`, `core/auth/auth-guard.ts`,
new `features/errors/forbidden.ts`, optionally `features/errors/redirecting.ts`

- Model `ForbiddenComponent` on `features/not-found/not-found.ts` for markup and
  routing style.
- `admin-guard.ts`: inject `Router`, `return router.createUrlTree(['/403'])` on
  the non-admin branch; still `await auth.whenReady()` (from 0.1).
- `/settings` route: `canActivate: [authGuard, adminGuard]`.
- Interstitial: simplest is for `authGuard` to return
  `router.createUrlTree(['/redirecting'])` and have that component call
  `auth.redirectToLogin()` in its constructor. Avoids a flash of nothing.
- Add both new routes to `app.routes.ts`; `*` wildcard still → `NotFound`.

## Tests first (TDD)

- `admin-guard.spec.ts`: non-admin → `UrlTree` to `/403`; admin → `true`;
  unauthenticated → defers to `authGuard` behaviour.
- Route config test: `/settings` has `authGuard` **and** `adminGuard`.
- `forbidden.spec.ts`: renders the 403 copy + a working `/pages` link.
- `auth-guard.spec.ts`: unauthenticated → `UrlTree` to `/redirecting` (update
  from step 0.1's expectations).

## Acceptance criteria

- [ ] `/403` route + `ForbiddenComponent` exist and render the copy.
- [ ] Non-admin hitting `/admin/*` **or** `/settings` lands on `/403`.
- [ ] `adminGuard` no longer redirects to `/pages`.
- [ ] An interstitial (not a blank screen) shows during the sign-in redirect.
- [ ] `permission.ts` tile/menu filtering still works.

## Out of scope

- Restyling `NotFound` or admin screens (→ Phase 8).
- Back-chevron navigation on admin screens (→ step 8.1).
