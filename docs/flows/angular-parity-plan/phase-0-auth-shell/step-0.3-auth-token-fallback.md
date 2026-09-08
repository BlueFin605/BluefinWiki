# Step 0.3 — Auth token fallback (idToken || accessToken)

| | |
|---|---|
| Phase | 0 — Auth & app-shell correctness |
| Gap refs | F7; punch list 🟠 |
| Impact | ⚪ in the doc — **promoted to do** per resolved decisions |
| Depends on | none (touches the same file as 0.2 — sequence after 0.2) |
| Est. size | S |

## Problem

React sets `Authorization` to `idToken || accessToken`. Angular sends the id
token only (`auth-interceptor.ts:18` → `auth.getIdToken()`), with no fallback.

## Target behaviour

- Add `Auth.getAccessToken(): string | null` (reads `ACCESS_TOKEN_KEY` from
  `localStorage`, mirroring `getIdToken()`).
- Interceptor builds the header from `auth.getIdToken() ?? auth.getAccessToken()`.
- The 401 refresh retry (step 0.2) uses the same precedence for its retry token.

## Implementation notes

**Files:** `core/auth/auth.ts`, `core/auth/auth-interceptor.ts`

- `ACCESS_TOKEN_KEY` already exists in `auth.ts:13` and is persisted in
  `persistSession()`. Only a getter is missing.
- Keep it a plain synchronous read; no session calls.

## Tests first (TDD)

- `auth.spec.ts`: `getAccessToken()` returns the stored value / null.
- `auth-interceptor.spec.ts`: id token present → id token used; id token
  absent, access token present → access token used; neither → no
  `Authorization` header.

## Acceptance criteria

- [ ] `Auth.getAccessToken()` exists and is covered.
- [ ] Interceptor prefers id token, falls back to access token.
- [ ] Retry path (0.2) uses the same fallback.

## Out of scope

- Any change to what the backend accepts — this is a client-side safety net.
