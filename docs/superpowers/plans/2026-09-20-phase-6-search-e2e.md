# Phase 6 Search Dialog E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** automate the 6 still-owed manual-walkthrough exit-criteria items
for Phase 6 (keyboard nav, pagination, rate limit, recent searches,
highlighting, `aria-live` announcements). Item 7 (visible Search button) is
**already fully covered** by `e2e/tests/search-and-global.spec.ts` (items 27
and 28, both breakpoints) — no new work for it.

**Architecture:** real semantic search (Bedrock embeddings + S3 Vectors,
per `search.ts`'s own file header) is slow and non-deterministic to seed and
rank against — unsuitable for deterministic pagination/highlighting/keyboard
assertions. This plan's **design decision**: introduce `page.route()`
interception for `/api/search*` to serve deterministic, instant, canned
result sets for every item except rate-limiting and recent-searches (which
don't need real content, just correct UI-state behavior, and get the same
mock for speed/reliability). This is a genuine first for this suite's search
tests — call it out in review rather than let it pass silently.

**Tech Stack:** Playwright (`e2e/`), local Aspire dev stack.

## Global Constraints

- Work happens **in place** on branch `feat/angular-rewrite` (NOT master, NO
  worktree).
- `npm test` + `npm run lint` in `frontend/` stay green — no production
  files change in this plan.
- Every commit's message carries a `Plan:` trailer to this file.
- **Item 3 (rate limit) has no reset hook** — the `RateLimiter` inside the
  `Search` service (`providedIn: 'root'`) only resets when its 60s sliding
  window ages out or the Angular injector is recreated (a hard
  navigation/reload). Its own test must run in complete isolation (a fresh
  browser context, and/or an explicit `page.reload()` immediately before its
  dispatch sequence) so no other test in the same worker has already
  consumed budget against the same singleton. Keep it in its own file, not
  merged into another spec.
- Item 3's test is genuinely slow (~12+ seconds minimum, 61 distinct
  dispatches each separated by >200ms to clear `distinctUntilChanged`) — per
  the roadmap doc, this is why Phase 6 is sequenced last among the five.

---

## File Structure

- Create: `e2e/fixtures/search-mock.ts` — `page.route()`-based canned-response helper
- Create: `e2e/tests/search-keyboard-nav.spec.ts` — item 1
- Create: `e2e/tests/search-pagination.spec.ts` — item 2
- Create: `e2e/tests/search-rate-limit.spec.ts` — item 3
- Create: `e2e/tests/search-recent.spec.ts` — item 4
- Create: `e2e/tests/search-highlighting.spec.ts` — item 5
- Create: `e2e/tests/search-aria-live.spec.ts` — item 6
- Modify: `docs/flows/angular-parity-plan/phase-6-search/README.md`

---

### Task 1: `search-mock.ts` fixture

**Files:**
- Create: `e2e/fixtures/search-mock.ts`

**Interfaces:**
- Produces: `mockSearch(page: Page, resultsByOffset: (offset: number, limit: number) => {results: WikiSearchResult[]; total: number}): Promise<void>` — a function-based responder so pagination tests can compute different slices per call, and a simpler `mockSearchFixed(page: Page, results: WikiSearchResult[]): Promise<void>` wrapper for tests that just want one static result set every time (keyboard nav, highlighting, aria-live). Consumed by Tasks 2, 3, 5, 6.

**First, read the real DTO shape** (`frontend/src/app/features/search/search.types.ts`)
before writing this fixture — the snippet below assumes `title`, `snippet`,
`tags`, `pageId`/`guid` fields based on the investigation summary; confirm
exact field names against the real `WikiSearchResult` type first.

- [ ] **Step 1: Read `search.types.ts` and reconcile field names**

- [ ] **Step 2: Write the fixture**

```ts
import type { Page } from '@playwright/test';

export interface MockSearchResult {
  pageId: string;
  title: string;
  snippet: string;
  tags: string[];
}

export async function mockSearch(
  page: Page,
  responder: (query: string, offset: number, limit: number) => { results: MockSearchResult[]; total: number; executionTimeMs?: number },
): Promise<void> {
  await page.route('**/api/search*', (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const { results, total, executionTimeMs } = responder(query, offset, limit);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results, total, executionTimeMs: executionTimeMs ?? 5 }),
    });
  });
}

export async function mockSearchFixed(page: Page, results: MockSearchResult[]): Promise<void> {
  await mockSearch(page, (_query, offset, limit) => ({
    results: results.slice(offset, offset + limit),
    total: results.length,
  }));
}

export function makeResult(i: number, overrides: Partial<MockSearchResult> = {}): MockSearchResult {
  return {
    pageId: `mock-page-${i}`,
    title: `Mock Result ${i}`,
    snippet: `This is a mock snippet for result number ${i}, containing a searchable term.`,
    tags: ['mock', 'e2e'],
    ...overrides,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/fixtures/search-mock.ts
git commit -m "$(cat <<'EOF'
test(e2e): add search route-mocking fixture for deterministic search e2e coverage

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

(No standalone run — exercised for real starting Task 2.)

---

### Task 2: `search-keyboard-nav.spec.ts` (item 1)

**Files:**
- Create: `e2e/tests/search-keyboard-nav.spec.ts`

**Interfaces:**
- Consumes: `mockSearchFixed`, `makeResult` (Task 1), `openSearch` (`e2e/tests/helpers.ts`, already exists).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mockSearchFixed, makeResult } from '../fixtures/search-mock';
import { openSearch } from './helpers';

test.describe('Search keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchFixed(page, [makeResult(1), makeResult(2), makeResult(3)]);
    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('mock');
    await expect(page.getByRole('option', { name: /Mock Result 1/ })).toBeVisible();
  });

  test('ArrowDown/ArrowUp move selection and clamp at the ends', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Search wiki' });
    await input.press('ArrowDown');
    await expect(page.getByRole('option', { name: /Mock Result 1/ })).toHaveClass(/selected/);
    await input.press('ArrowUp'); // clamps, doesn't wrap to the last item
    await expect(page.getByRole('option', { name: /Mock Result 1/ })).toHaveClass(/selected/);
  });

  test('Home/End jump to first/last result', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Search wiki' });
    await input.press('End');
    await expect(page.getByRole('option', { name: /Mock Result 3/ })).toHaveClass(/selected/);
    await input.press('Home');
    await expect(page.getByRole('option', { name: /Mock Result 1/ })).toHaveClass(/selected/);
  });

  test('hovering a row sets selection', async ({ page }) => {
    await page.getByRole('option', { name: /Mock Result 2/ }).hover();
    await expect(page.getByRole('option', { name: /Mock Result 2/ })).toHaveClass(/selected/);
  });

  test('Enter opens the selected result', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Search wiki' });
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/pages\/mock-page-1/);
  });

  test('Ctrl/Cmd+Enter opens the result in a new tab and keeps the dialog open', async ({ page, context }) => {
    const input = page.getByRole('combobox', { name: 'Search wiki' });
    await input.press('ArrowDown');
    const [newPage] = await Promise.all([context.waitForEvent('page'), input.press('Control+Enter')]);
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('/pages/mock-page-1');
    await expect(page.getByRole('dialog')).toBeVisible(); // original dialog still open
  });
});
```

- [ ] **Step 2: Verify the platform-correct modifier**

`Control+Enter` is right for Linux/Windows runners; on macOS the app's own
code checks `metaKey`. If CI/the dev machine is macOS, use `Meta+Enter`
instead, or send both via `page.keyboard.down('Meta')`/`down('Control')`
conditionally on `process.platform`. Confirm which this repo's e2e CI target
platform actually is before finalizing.

- [ ] **Step 3: Run it**

Run: `cd e2e && npx playwright test search-keyboard-nav.spec.ts`
Expected: 6/6 pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/search-keyboard-nav.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add search keyboard-nav coverage (Phase 6 item 1)

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

---

### Task 3: `search-pagination.spec.ts` (item 2)

**Files:**
- Create: `e2e/tests/search-pagination.spec.ts`

**Interfaces:**
- Consumes: `mockSearch`, `makeResult` (Task 1), `openSearch`.

Uses the offset-aware `mockSearch` (not `mockSearchFixed`) so "Load more"
genuinely returns a second page.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mockSearch, makeResult } from '../fixtures/search-mock';
import { openSearch } from './helpers';

test.describe('Search pagination', () => {
  test('Load more results appends the next page and updates the count', async ({ page }) => {
    const allResults = Array.from({ length: 25 }, (_, i) => makeResult(i + 1));
    await mockSearch(page, (_q, offset, limit) => ({ results: allResults.slice(offset, offset + limit), total: allResults.length }));

    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('mock');

    await expect(page.getByRole('button', { name: /Load more results \(10 of 25\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Load more results/ }).click();
    await expect(page.getByRole('button', { name: /Load more results \(20 of 25\)/ })).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(20);

    await page.getByRole('button', { name: /Load more results/ }).click();
    await expect(page.getByRole('button', { name: /Load more/ })).toHaveCount(0); // all loaded
    await expect(page.getByText('25 result(s) in')).toBeVisible();
  });

  test('changing the page-size toggle resets pagination from offset 0', async ({ page }) => {
    const allResults = Array.from({ length: 30 }, (_, i) => makeResult(i + 1));
    await mockSearch(page, (_q, offset, limit) => ({ results: allResults.slice(offset, offset + limit), total: allResults.length }));

    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('mock');
    await expect(page.getByRole('option')).toHaveCount(10);

    await page.getByRole('radio', { name: '25' }).click();
    await expect(page.getByRole('option')).toHaveCount(25); // reset, not appended (would be 35 if appended)
  });
});
```

- [ ] **Step 2: Verify the page-size control's real role**

Confirmed as `mat-button-toggle-group[aria-label="Results per page"]` with
values `10/25/50` — Material single-select toggle groups commonly expose
each option as `role="radio"`, but verify against the live DOM (same
ambiguity flagged in Phase 5/8's plans for other toggle groups) before
trusting `getByRole('radio', ...)`.

Run: `cd e2e && npx playwright test search-pagination.spec.ts --headed`

- [ ] **Step 3: Run the full file**

Run: `cd e2e && npx playwright test search-pagination.spec.ts`
Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/search-pagination.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add search pagination coverage (Phase 6 item 2)

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

---

### Task 4: `search-rate-limit.spec.ts` (item 3)

**Files:**
- Create: `e2e/tests/search-rate-limit.spec.ts`

**Interfaces:**
- Consumes: `mockSearchFixed`, `makeResult` (Task 1). Deliberately does **not** share a worker/context with other search specs — see Global Constraints.

`RATE_LIMIT_MESSAGE` = `'Too many searches. Please wait a moment.'`,
purely client-side (`rate-limiter.ts`, max=60/60s). Trip it by toggling the
scope selector 61 times (each toggle is a genuinely distinct dispatched
query per `distinctUntilChanged`), each separated by >200ms to clear the
debounce.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mockSearchFixed, makeResult } from '../fixtures/search-mock';
import { openSearch } from './helpers';

test.describe('Search rate limiting', () => {
  test.describe.configure({ mode: 'serial' }); // isolate this file's own dispatch budget from parallel workers

  test('more than 60 searches per minute shows the rate-limit message', async ({ page }) => {
    test.setTimeout(30_000);
    await mockSearchFixed(page, [makeResult(1)]);
    await page.goto('/pages');
    await openSearch(page);

    const input = page.getByRole('combobox', { name: 'Search wiki' });
    await input.fill('seed'); // dispatch #1

    // 60 more distinct dispatches via the scope toggle (each a genuinely
    // different {text, scope, pageSize} tuple, clearing distinctUntilChanged),
    // each separated by >200ms to clear the debounce window.
    const scopes = ['Titles', 'Content', 'All'] as const;
    for (let i = 0; i < 60; i++) {
      await page.getByRole('radio', { name: scopes[i % scopes.length] }).click();
      await page.waitForTimeout(220);
    }

    await expect(page.locator('.error')).toHaveText('Too many searches. Please wait a moment.');
  });
});
```

- [ ] **Step 2: Verify the scope selector's real role/name**

Confirm `All / Titles / Content` renders as `role="radio"` (same Material
toggle-group ambiguity as Tasks 2/3) before trusting this loop — this test
is expensive to re-run, get the selector right on the first real pass.

- [ ] **Step 3: Run it in complete isolation**

Run: `cd e2e && npx playwright test search-rate-limit.spec.ts --workers=1`
Expected: 1/1 pass, taking roughly 13-15 seconds. Do not run this file
concurrently with any other spec in the same worker — the `Search` service
singleton's rate-limit budget is shared per Angular injector instance, and a
prior test's dispatches in the same page/context would desync the count
this test needs to land exactly on 61.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/search-rate-limit.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add search client-side rate-limit coverage (Phase 6 item 3)

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

---

### Task 5: `search-recent.spec.ts` (item 4)

**Files:**
- Create: `e2e/tests/search-recent.spec.ts`

**Interfaces:**
- Consumes: `mockSearchFixed`, `makeResult` (Task 1).

`localStorage` key `'bluefinwiki:recent-searches'`, JSON array, most-recent-first,
capped at 10. Seed/clear via `page.addInitScript`/`page.evaluate`.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mockSearchFixed, makeResult } from '../fixtures/search-mock';
import { openSearch } from './helpers';

const RECENT_KEY = 'bluefinwiki:recent-searches';

test.describe('Recent searches', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => localStorage.removeItem(key), RECENT_KEY);
  });

  test('empty query with no history shows the hint', async ({ page }) => {
    await mockSearchFixed(page, []);
    await page.goto('/pages');
    await openSearch(page);
    await expect(page.getByText('Start typing to search...')).toBeVisible();
  });

  test('seeded recent searches render with per-item remove and Clear all', async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [RECENT_KEY, JSON.stringify(['alpha', 'beta', 'gamma'])],
    );
    await mockSearchFixed(page, [makeResult(1)]);
    await page.goto('/pages');
    await openSearch(page);

    await expect(page.getByText('Recent searches')).toBeVisible();
    await expect(page.getByRole('button', { name: 'gamma' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove recent search beta' }).click();
    await expect(page.getByRole('button', { name: 'beta' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText('Recent searches')).toHaveCount(0);
    await expect(page.getByText('Start typing to search...')).toBeVisible();
  });

  test('selecting a result records its query as a recent search', async ({ page }) => {
    await mockSearchFixed(page, [makeResult(1)]);
    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('widgets');
    await page.getByRole('option', { name: /Mock Result 1/ }).click();

    const stored = await page.evaluate((key) => localStorage.getItem(key), RECENT_KEY);
    expect(JSON.parse(stored ?? '[]')).toContain('widgets');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test search-recent.spec.ts`
Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/search-recent.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add recent-searches coverage (Phase 6 item 4)

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

---

### Task 6: `search-highlighting.spec.ts` (item 5)

**Files:**
- Create: `e2e/tests/search-highlighting.spec.ts`

**Interfaces:**
- Consumes: `mockSearchFixed`, `makeResult` (Task 1).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mockSearchFixed } from '../fixtures/search-mock';
import { openSearch } from './helpers';

test.describe('Search result highlighting, tags, clamp', () => {
  test('matched terms are <mark>-highlighted; up to 3 tags shown; snippet is clamped to 2 lines', async ({ page }) => {
    await mockSearchFixed(page, [
      {
        pageId: 'p1',
        title: 'Widget Overview',
        snippet: 'This page explains widgets in detail with a very long snippet that should be clamped visually.',
        tags: ['widgets', 'overview', 'hardware', 'extra-tag'],
      },
    ]);

    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('widget');

    const result = page.getByRole('option', { name: /Widget Overview/ });
    await expect(result.locator('.title mark')).toHaveText(/widget/i);
    await expect(result.locator('.snippet mark')).toHaveText(/widget/i);
    await expect(result.locator('.tag')).toHaveCount(3); // capped at MAX_TAGS

    const clampStyle = await result.locator('.snippet').evaluate((el) => getComputedStyle(el).webkitLineClamp || getComputedStyle(el).getPropertyValue('line-clamp'));
    expect(clampStyle).toBe('2');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test search-highlighting.spec.ts`
Expected: 1/1 pass. If `webkitLineClamp` reads empty in headless Chromium,
fall back to asserting the `-webkit-line-clamp` CSS property via
`el.style` or a computed-style property name check rather than pixel-height
math (per the investigation's own recommendation — visual wrapping depends
on font metrics, not something to assert directly).

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/search-highlighting.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add search highlighting/tags/clamp coverage (Phase 6 item 5)

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

---

### Task 7: `search-aria-live.spec.ts` (item 6) + doc close-out

**Files:**
- Create: `e2e/tests/search-aria-live.spec.ts`
- Modify: `docs/flows/angular-parity-plan/phase-6-search/README.md`
- Modify: `docs/flows/angular-parity-plan/README.md` (only if not already updated this session — this is likely the LAST of the five phase plans to execute per the roadmap's sequencing, so this task's Step 4 should also finalize the Total row once all five are confirmed merged)

**Interfaces:**
- Consumes: `mockSearch` (Task 1, needs an artificial delay to reliably observe the "Searching…" transient state).

`[aria-live="polite"]`, scoped assertions required (the same text also
appears in visible `.error`/`.hint`/`.footer` elements).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { mockSearch, makeResult } from '../fixtures/search-mock';
import { openSearch } from './helpers';

test.describe('Search aria-live announcements', () => {
  test('announces Searching, then N results found', async ({ page }) => {
    await mockSearch(page, async (_q, offset, limit) => {
      return { results: [makeResult(1), makeResult(2)].slice(offset, offset + limit), total: 2 };
    });
    // Add artificial latency so "Searching…" is observable, not raced past.
    await page.route('**/api/search*', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });

    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('mock');

    const live = page.locator('[aria-live="polite"]');
    await expect(live).toHaveText('Searching…');
    await expect(live).toHaveText('2 results found');
  });

  test('announces No results for an empty result set', async ({ page }) => {
    await mockSearch(page, () => ({ results: [], total: 0 }));
    await page.goto('/pages');
    await openSearch(page);
    await page.getByRole('combobox', { name: 'Search wiki' }).fill('nonexistent-term');

    await expect(page.locator('[aria-live="polite"]')).toHaveText('No results');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test search-aria-live.spec.ts`
Expected: 2/2 pass. The "Searching…" assertion is the one genuinely timing-sensitive
part of this whole plan aside from Task 4 — if it flakes because the debounce
+ artificial latency window is too tight, increase the injected delay
(400ms) rather than adding a fixed `waitForTimeout` before the assertion.

- [ ] **Step 3: Update `phase-6-search/README.md`'s exit criteria**

Tick items 1-6 `[x]` (all newly automated). Item 7 already ticked by
whatever landed `search-and-global.spec.ts` — confirm it's still marked,
don't re-tick with a false "new" attribution.

- [ ] **Step 4: Update the top-level status board**

Check `git log --oneline -- docs/flows/angular-parity-plan/README.md` first.
If Phases 2, 5, 7, 8's plans have already landed and updated their own rows,
this task's edit both updates Phase 6's row **and** finalizes the **Total**
row's closing sentence (drop the "remain owed" phrase entirely once all five
phases show automated coverage — the roadmap doc's "What done means" section
describes this "whoever lands last" pattern). If some of those four haven't
landed yet, just update Phase 6's own row and leave the Total row for
whichever phase plan genuinely lands last.

- [ ] **Step 5: Full-suite regression check**

Run: `cd e2e && npx playwright test`
Expected: all prior + all new Phase 6 specs pass. Also run
`cd e2e && npx tsc --noEmit` and `cd frontend && npm test && npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/search-aria-live.spec.ts \
  docs/flows/angular-parity-plan/phase-6-search/README.md \
  docs/flows/angular-parity-plan/README.md
git commit -m "$(cat <<'EOF'
test(e2e): add search aria-live coverage, close Phase 6's manual-walkthrough debt (item 6)

Plan: docs/superpowers/plans/2026-09-20-phase-6-search-e2e.md
EOF
)"
```

---

## Self-Review Notes

- **Task 4 (rate limit) is the single most expensive and most isolation-sensitive
  test across all five phase plans** — do not relax its `workers: 1` run
  instruction or merge it into a shared spec file under time pressure.
- Multiple tasks (2, 3, 4) depend on confirming Material's real toggle-group
  ARIA pattern (`role="radio"` vs. `aria-pressed` vs. a plain checked
  class) — this is the same open question Phase 5 and Phase 8's plans also
  flag for their own toggle groups. Whichever phase plan executes **first**
  should resolve it empirically and leave a note (e.g. in this repo's
  `e2e/tests/helpers.ts` as a comment, or in a shared fixture) so the other
  phase plans don't each independently re-discover it.
- This plan's `search-mock.ts` fixture (Task 1) is the first `page.route()`
  interception for *search* specifically — Phase 5 and Phase 7's plans
  introduce the same general Playwright technique for different endpoints;
  no code sharing is expected between them (different domains), but the
  *pattern* is now established in three places by the time all five phases
  land — worth a brief mention in whichever whole-branch review covers the
  last of these phases to land, in case a shared `e2e/fixtures/mock-route.ts`
  utility becomes worth extracting at that point (not now — YAGNI until a
  third near-identical implementation actually appears character-for-character
  similar).
