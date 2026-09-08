# Step 6.3 — Client rate-limit 60/min

| | |
|---|---|
| Phase | 6 — Search dialog |
| Gap refs | §3.6 "Client rate-limit 60/min"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

React has a client-side limiter: 60 searches/min, showing "Too many searches.
Please wait a moment." Angular has none.

## Target behaviour

- A sliding-window limiter: at most 60 search requests in any rolling 60 s.
- When the limit is hit, suppress the request and surface "Too many searches.
  Please wait a moment." in the dialog; clear it once capacity frees.
- Debounced input still applies before the limiter (the limiter counts actual
  dispatched requests).

## Implementation notes

**Files:** `features/search/search.ts` (or a small `RateLimiter` util it uses).

- Pure `RateLimiter(max, windowMs)` with `tryAcquire(now) => boolean` backed by
  a timestamp queue; unit-testable with an injected clock.
- The dialog reads a `rateLimited` signal to show/hide the message.

## Tests first (TDD)

- `rate-limiter.spec.ts`: 60 acquires in the window succeed, the 61st fails;
  after the oldest timestamp ages out, one more succeeds.
- `search.spec.ts`: the 61st rapid query does not hit `HttpClient` and sets the
  rate-limited message.

## Acceptance criteria

- [ ] ≤60 dispatched searches per rolling minute.
- [ ] Over-limit shows the exact message; recovers automatically.
- [ ] `RateLimiter` unit-tested with a fake clock.

## Out of scope

- Server-side limiting (backend concern).
