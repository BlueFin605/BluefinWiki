# Phase 5 Board View E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** automate all 6 still-owed manual-walkthrough exit-criteria items
for Phase 5 (child-state eligibility, >200-card pagination, optimistic
column drag + rollback, positional `boardOrder` reorder, Board-Settings type
filtering, Card Summary dialog edit/save/open-full-editor) as Playwright
specs, extending the one existing partial spec
(`e2e/tests/board-view-functional.spec.ts`) rather than duplicating it.

**Architecture:** validation tests against already-shipped, whole-branch-reviewed
code. This is the largest and riskiest of the five phase plans: it needs
CDK drag-drop (same flakiness class Phase 2's plan hardens), `page.route()`
failure-injection (first use of that pattern for the *board*, though Phase 7
and Phase 8's plans establish the general technique first if executed
earlier — see the roadmap doc), and a bulk-fixture-creation helper for the
>200-card case since **no bulk page-create endpoint exists anywhere in
`backend/src`**.

**Tech Stack:** Playwright (`e2e/`), local Aspire dev stack.

## Global Constraints

- Work happens **in place** on branch `feat/angular-rewrite` (NOT master, NO
  worktree).
- `npm test` + `npm run lint` in `frontend/` stay green — no production
  files change in this plan unless a task explicitly finds and reports a
  real product bug (matches this repo's standing pattern: report, don't
  silently work around).
- Every commit's message carries a `Plan:` trailer to this file.
- The >200-card fixture (Task 2) must batch its `POST /pages` calls in small
  concurrent groups (10-20 at a time), never one giant `Promise.all(201
  calls)` and never fully sequential — `playwright.config.ts`'s own comment
  documents the local Express+LocalStack backend "falling over" under too
  much concurrent load, and this plan's fixture is the single largest
  concurrent-create burst introduced by any phase plan so far.
- Give the >200-card test a generous explicit `test.setTimeout()` — fixture
  setup alone will take real wall-clock time.

---

## File Structure

- Modify: `e2e/tests/helpers.ts` — reuse `dragToRowZone`-style pattern if Phase 2 landed first; otherwise this plan's Task 1 adds a board-scoped equivalent directly (`dragCardToColumn`)
- Create: `e2e/fixtures/bulk-pages.ts` — batched bulk page-create helper
- Create: `e2e/tests/board-eligibility.spec.ts` — item 1
- Create: `e2e/tests/board-pagination.spec.ts` — item 2
- Create: `e2e/tests/board-drag-columns.spec.ts` — item 3
- Create: `e2e/tests/board-drag-reorder.spec.ts` — item 4
- Create: `e2e/tests/board-settings-types.spec.ts` — item 5
- Modify: `e2e/tests/board-view-functional.spec.ts` — extend for item 6's uncovered parts
- Modify: `docs/flows/angular-parity-plan/phase-5-board/README.md`

---

### Task 1: `dragCardToColumn()` helper + `bulk-pages.ts`

**Files:**
- Modify: `e2e/tests/helpers.ts`
- Create: `e2e/fixtures/bulk-pages.ts`

**Interfaces:**
- Produces: `dragCardToColumn(page: Page, card: Locator, column: Locator, position?: 'start' | 'end' | number): Promise<void>` (consumed by Tasks 4, 5) and `createManyChildren(request: APIRequestContext, parentGuid: string, count: number, titlePrefix: string, opts?: {pageType?: string; properties?: Record<string, unknown>}): Promise<string[]>` (consumed by Task 3).

**Before writing `dragCardToColumn`:** check whether Phase 2's plan
(`2026-09-20-phase-2-tree-crud-e2e.md`) has already landed its
`dragToRowZone` helper in `e2e/tests/helpers.ts` — if so, this board helper
should follow the identical "compute target once, never re-read mid-drag"
discipline that helper documents (same underlying CDK flakiness class,
different drop-list), but board cards drop into a column's `.cards`
container rather than a row's quartile band, so it's a distinct function,
not a reuse of the tree one.

- [ ] **Step 1: Add `dragCardToColumn` to `e2e/tests/helpers.ts`**

```ts
export async function dragCardToColumn(
  page: Page,
  card: Locator,
  column: Locator,
  position: 'start' | 'end' | number = 'end',
): Promise<void> {
  const cardBox = await card.boundingBox();
  const cardsContainer = column.locator('.cards');
  const containerBox = await cardsContainer.boundingBox();
  if (!cardBox || !containerBox) throw new Error('dragCardToColumn: missing bounding box');

  const targetX = containerBox.x + containerBox.width / 2;
  const targetY =
    position === 'start'
      ? containerBox.y + 10
      : position === 'end'
        ? containerBox.y + containerBox.height - 10
        : containerBox.y + (position as number); // caller-supplied pixel offset for between-card drops

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 10, cardBox.y + cardBox.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
```

- [ ] **Step 2: Write `e2e/fixtures/bulk-pages.ts`**

```ts
import type { APIRequestContext } from '@playwright/test';
import { API_BASE_URL, AUTH_HEADER } from './api';

const BATCH_SIZE = 15; // stays under the backend-concurrency ceiling playwright.config.ts already caps workers for

export async function createManyChildren(
  request: APIRequestContext,
  parentGuid: string,
  count: number,
  titlePrefix: string,
  opts: { pageType?: string; properties?: Record<string, unknown> } = {},
): Promise<string[]> {
  const guids: string[] = [];
  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, count - i);
    const batch = Array.from({ length: batchSize }, (_, j) => {
      const index = i + j;
      return request
        .post(`${API_BASE_URL}/pages`, {
          headers: AUTH_HEADER,
          data: {
            title: `${titlePrefix} ${index}`,
            content: `# ${titlePrefix} ${index}`,
            parentGuid,
            ...(opts.pageType ? { pageType: opts.pageType } : {}),
            ...(opts.properties ? { properties: opts.properties } : {}),
          },
        })
        .then(async (res) => {
          if (!res.ok()) throw new Error(`createManyChildren: ${res.status()} ${await res.text()}`);
          return ((await res.json()) as { guid: string }).guid;
        });
    });
    guids.push(...(await Promise.all(batch)));
  }
  return guids;
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/helpers.ts e2e/fixtures/bulk-pages.ts
git commit -m "$(cat <<'EOF'
test(e2e): add board drag helper + batched bulk-page-create fixture

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

(No standalone run — both are exercised for real starting Task 2.)

---

### Task 2: `board-eligibility.spec.ts` (item 1)

**Files:**
- Create: `e2e/tests/board-eligibility.spec.ts`

**Interfaces:**
- Consumes: `createPage`/`updatePage`/`pageTree`, `createPageType`.

Deliberately does **not** set `boardConfig.targetTypeGuid` — the existing
`board-view-functional.spec.ts` spec always does, so this is genuinely new
coverage of `is-board-eligible.ts`'s auto-eligibility path (a child whose
type defines a `state` property, with a non-empty value, makes the parent
eligible with zero board config).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';

test.describe('Board eligibility without explicit config', () => {
  test('a page whose children have a state-bearing type is board-eligible with no boardConfig', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Auto-Eligible Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Auto-Eligible Parent`, { parentGuid: pageTree.rootGuid });
    await createPage(request, `${prefix} Child With State`, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      const boardToggle = page.getByRole('button', { name: 'Board' }); // mat-button-toggle within the view-toggle group
      await expect(boardToggle).toBeVisible(); // the toggle only renders at all when boardEligible() is true
      await boardToggle.click();
      await expect(page.locator('wiki-board-column', { hasText: 'To Do' })).toBeVisible();
    } finally {
      await deletePageType(request, typeGuid);
    }
  });

  test('a state-schema type whose child has no value set does NOT make the parent eligible', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Unset-State Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Not Eligible Parent`, { parentGuid: pageTree.rootGuid });
    await createPage(request, `${prefix} Child Without State Value`, { parentGuid, pageType: typeGuid });

    try {
      await page.goto(`/pages/${parentGuid}`);
      await expect(page.getByRole('button', { name: 'Board' })).toHaveCount(0);
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test board-eligibility.spec.ts`
Expected: 2/2 pass. If the `mat-button-toggle` selector doesn't resolve
cleanly (the view-toggle group may need `.getByRole('radio', {name:
'Board'})` depending on Material's rendering, per Phase 8's plan hitting the
same ambiguity for invitation-status pills), run headed and reconcile.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/board-eligibility.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add board child-state auto-eligibility coverage (Phase 5 item 1)

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

---

### Task 3: `board-pagination.spec.ts` (item 2)

**Files:**
- Create: `e2e/tests/board-pagination.spec.ts`

**Interfaces:**
- Consumes: `createManyChildren` (Task 1), `createPageType`, `updatePage`.

`PAGE_SIZE = 200` (`board-view.ts:36`), backend `MAX_LIMIT = 500`. Create
201 boardable children so exactly one "Load more cards" click is needed.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { createManyChildren } from '../fixtures/bulk-pages';

test.describe('Board pagination', () => {
  test('a board with more than 200 cards shows Load more and loads the next page', async ({
    page,
    pageTree,
    request,
  }) => {
    test.setTimeout(120_000); // 201 batched POSTs take real wall-clock time

    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Pagination Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Pagination Parent`, { parentGuid: pageTree.rootGuid });
    await updatePage(request, parentGuid, { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } });

    await createManyChildren(request, parentGuid, 201, `${prefix} Card`, {
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      const column = page.locator('wiki-board-column', { hasText: 'To Do' });
      await expect(column).toBeVisible();
      await expect(column.locator('[data-testid="board-column-count"]')).toHaveText('200');

      const loadMore = page.getByRole('button', { name: /^Load more cards/ });
      await expect(loadMore).toBeVisible();
      await loadMore.click();
      await expect(loadMore).toBeHidden({ timeout: 15_000 });
      await expect(column.locator('[data-testid="board-column-count"]')).toHaveText('201');
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test board-pagination.spec.ts`
Expected: 1/1 pass, but expect this to be the slowest test in the entire
Phase 5 suite (fixture setup alone creates 201 pages). If fixture creation
itself times out or throws `socket hang up` errors, reduce `BATCH_SIZE` in
`bulk-pages.ts` further (e.g. to 10) rather than raising Playwright's
overall worker count.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/board-pagination.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add board >200-card Load-more pagination coverage (Phase 5 item 2)

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

---

### Task 4: `board-drag-columns.spec.ts` (item 3)

**Files:**
- Create: `e2e/tests/board-drag-columns.spec.ts`

**Interfaces:**
- Consumes: `dragCardToColumn` (Task 1).

Cross-column drag moves optimistically; a failed `PUT` rolls back with a
toast. Force the failure via `page.route()` on the specific card's guid —
first use of route-interception in this repo's board tests (confirmed no
prior precedent).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { dragCardToColumn } from './helpers';

test.describe('Board optimistic drag + rollback', () => {
  test('dragging a card to another column moves it immediately', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Drag Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Drag Parent`, { parentGuid: pageTree.rootGuid });
    const cardTitle = `${prefix} Draggable Card`;
    await createPage(request, cardTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });

    try {
      await page.goto(`/pages/${parentGuid}`);
      await request.put(`http://localhost:3000/pages/${parentGuid}`, {
        headers: { Authorization: 'Bearer mock-jwt-token' },
        data: { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } },
      });
      await page.reload();

      const todoColumn = page.locator('wiki-board-column', { hasText: 'To Do' });
      const doneColumn = page.locator('wiki-board-column', { hasText: 'Done' });
      const card = todoColumn.getByRole('button', { name: cardTitle });
      await expect(card).toBeVisible();

      await dragCardToColumn(page, card, doneColumn);
      await expect(doneColumn.getByRole('button', { name: cardTitle })).toBeVisible({ timeout: 5000 });
    } finally {
      await deletePageType(request, typeGuid);
    }
  });

  test('a failed PUT during drag rolls the card back with a toast', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Rollback Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Rollback Parent`, {
      parentGuid: pageTree.rootGuid,
    });
    const cardTitle = `${prefix} Rollback Card`;
    const cardGuid = await createPage(request, cardTitle, {
      parentGuid,
      pageType: typeGuid,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    await request.put(`http://localhost:3000/pages/${parentGuid}`, {
      headers: { Authorization: 'Bearer mock-jwt-token' },
      data: { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } },
    });

    try {
      await page.route(`**/api/pages/${cardGuid}`, (route) => {
        if (route.request().method() === 'PUT') {
          return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Simulated PUT failure' }) });
        }
        return route.continue();
      });

      await page.goto(`/pages/${parentGuid}`);
      const todoColumn = page.locator('wiki-board-column', { hasText: 'To Do' });
      const doneColumn = page.locator('wiki-board-column', { hasText: 'Done' });
      const card = todoColumn.getByRole('button', { name: cardTitle });
      await expect(card).toBeVisible();

      await dragCardToColumn(page, card, doneColumn);

      // Rolls back: card returns to To Do, error toast shown.
      await expect(page.getByText(/Couldn't move card/)).toBeVisible({ timeout: 10_000 });
      await expect(todoColumn.getByRole('button', { name: cardTitle })).toBeVisible();
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
```

- [ ] **Step 2: Run both, with repeats on the drag itself**

Run: `cd e2e && npx playwright test board-drag-columns.spec.ts --repeat-each=3`
Expected: 6/6 pass (2 tests × 3 repeats). This is the second-highest flake
risk in this plan after the pagination test's fixture cost — if the drag
itself is flaky, widen `dragCardToColumn`'s drop-target margins (the `10`px
insets in Task 1's helper) before adding retries.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/board-drag-columns.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add board cross-column drag + PUT-failure-rollback coverage (Phase 5 item 3)

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

---

### Task 5: `board-drag-reorder.spec.ts` (item 4)

**Files:**
- Create: `e2e/tests/board-drag-reorder.spec.ts`

**Interfaces:**
- Consumes: `dragCardToColumn` (Task 1, called with a numeric `position` to land between two known cards within one column).

`computeBoardOrder` (`compute-board-order.ts`) is already unit-tested;
this validates the real drag → position → persistence → reload path.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';
import { dragCardToColumn } from './helpers';

test.describe('Board positional reorder (boardOrder)', () => {
  test('dropping a card between two siblings persists order across reload', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const typeGuid = await createPageType(request, `${prefix} Reorder Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const parentGuid = await createPage(request, `${prefix} Reorder Parent`, { parentGuid: pageTree.rootGuid });
    await request.put(`http://localhost:3000/pages/${parentGuid}`, {
      headers: { Authorization: 'Bearer mock-jwt-token' },
      data: { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } },
    });

    const titleA = `${prefix} Card A`;
    const titleB = `${prefix} Card B`;
    const titleC = `${prefix} Card C`;
    await createPage(request, titleA, { parentGuid, pageType: typeGuid, properties: { state: { type: 'string', value: 'To Do' } } });
    await createPage(request, titleB, { parentGuid, pageType: typeGuid, properties: { state: { type: 'string', value: 'To Do' } } });
    await createPage(request, titleC, { parentGuid, pageType: typeGuid, properties: { state: { type: 'string', value: 'To Do' } } });

    try {
      await page.goto(`/pages/${parentGuid}`);
      const column = page.locator('wiki-board-column', { hasText: 'To Do' });
      await expect(column.getByRole('button', { name: titleC })).toBeVisible();

      // Move Card C to land between A and B (initial order: A, B, C).
      const cardC = column.getByRole('button', { name: titleC });
      const cardB = column.getByRole('button', { name: titleB });
      const cardBBox = await cardB.boundingBox();
      const columnBox = await column.boundingBox();
      if (!cardBBox || !columnBox) throw new Error('missing bounding box');
      await dragCardToColumn(page, cardC, column, cardBBox.y - columnBox.y - 5); // just above Card B

      const orderAfterDrag = await column.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(orderAfterDrag.indexOf(titleC)).toBeLessThan(orderAfterDrag.indexOf(titleB));
      expect(orderAfterDrag.indexOf(titleC)).toBeGreaterThan(orderAfterDrag.indexOf(titleA));

      await page.reload();
      const columnAfterReload = page.locator('wiki-board-column', { hasText: 'To Do' });
      const orderAfterReload = await columnAfterReload.getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
      expect(orderAfterReload.indexOf(titleC)).toBeLessThan(orderAfterReload.indexOf(titleB));
      expect(orderAfterReload.indexOf(titleC)).toBeGreaterThan(orderAfterReload.indexOf(titleA));
    } finally {
      await deletePageType(request, typeGuid);
    }
  });
});
```

- [ ] **Step 2: Run it, repeated for stability**

Run: `cd e2e && npx playwright test board-drag-reorder.spec.ts --repeat-each=3`
Expected: 3/3 pass. This is a within-column drop, a harder geometry than
Task 4's cross-column drop — if flaky, verify the `position` offset math
against the real rendered card heights (run headed once) rather than
guessing at a fixed pixel adjustment.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/board-drag-reorder.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add board positional boardOrder reorder + persistence coverage (Phase 5 item 4)

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

---

### Task 6: `board-settings-types.spec.ts` (item 5)

**Files:**
- Create: `e2e/tests/board-settings-types.spec.ts`

**Interfaces:**
- Consumes: `createPageType`.

`boardableTypes()` filters to types with a `state` property. Verify the
Board Settings "Target type" select only lists those.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage, updatePage } from '../fixtures/page-tree';
import { createPageType, deletePageType } from '../fixtures/page-types';

test.describe('Board Settings — boardable type filtering', () => {
  test('the Target type select lists only state-bearing types', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const boardableGuid = await createPageType(request, `${prefix} Boardable Type`, {
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const nonBoardableGuid = await createPageType(request, `${prefix} Non-Boardable Type`, {
      properties: [{ name: 'note', type: 'string', required: false }],
    });

    const parentGuid = await createPage(request, `${prefix} Settings Parent`, { parentGuid: pageTree.rootGuid });
    await updatePage(request, parentGuid, { boardConfig: { defaultView: 'board' } });

    try {
      await page.goto(`/pages/${parentGuid}`);
      // With no state-bearing children yet, eligibility comes from the
      // explicit `defaultView: 'board'` config plus at least one boardable
      // type existing overall -- open Board Settings directly.
      await page.getByRole('button', { name: 'Board settings' }).click();

      await page.getByLabel('Target type').click();
      await expect(page.getByRole('option', { name: new RegExp(`${prefix} Boardable Type`) })).toBeVisible();
      await expect(page.getByRole('option', { name: new RegExp(`${prefix} Non-Boardable Type`) })).toHaveCount(0);
    } finally {
      await deletePageType(request, boardableGuid);
      await deletePageType(request, nonBoardableGuid);
    }
  });

  test('with no boardable types at all, the select is disabled with an explanatory hint', async ({
    page,
    pageTree,
    request,
  }) => {
    const parentGuid = await createPage(request, `E2E-${pageTree.runId} No Boardable Types Parent`, {
      parentGuid: pageTree.rootGuid,
    });
    await updatePage(request, parentGuid, { boardConfig: { defaultView: 'board' } });

    await page.goto(`/pages/${parentGuid}`);
    await page.getByRole('button', { name: 'Board settings' }).click();
    await expect(page.getByText(/No page types define a "state" property/)).toBeVisible();
    await expect(page.getByLabel('Target type')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Reconcile whether "Board settings" is reachable without prior board-eligible state**

Investigation confirmed the Board Settings button only renders once
`viewMode()==='board'` is active — Step 1's flow assumes navigating with
`boardConfig.defaultView: 'board'` already set is enough to land in board
mode on load; verify this against `page-detail.ts`'s real
`viewMode`-initialization logic before trusting the test, adjusting to
explicitly click a Content/Board toggle first if needed.

Run: `cd e2e && npx playwright test board-settings-types.spec.ts --headed`

- [ ] **Step 3: Run the full file**

Run: `cd e2e && npx playwright test board-settings-types.spec.ts`
Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/board-settings-types.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add Board Settings boardable-type-filtering coverage (Phase 5 item 5)

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

---

### Task 7: Extend `board-view-functional.spec.ts` (item 6) + doc close-out

**Files:**
- Modify: `e2e/tests/board-view-functional.spec.ts`
- Modify: `docs/flows/angular-parity-plan/phase-5-board/README.md`
- Modify: `docs/flows/angular-parity-plan/README.md` (only if not already updated this session)

**Interfaces:**
- Consumes: existing fixtures already imported by that file.

The existing test already covers title/state edit + save + live column
move. This task adds: "Open full editor" opens a new tab at the right URL,
editing a non-`state` property, and Save staying disabled until dirty.

- [ ] **Step 1: Add the new assertions as additional tests in the same `describe` block**

```ts
test('Card Summary: Save is disabled until a field is dirty, and "Open full editor" opens the page in a new tab', async ({
  page,
  pageTree,
  request,
}) => {
  const prefix = `E2E-${pageTree.runId}`;
  const typeGuid = await createPageType(request, `${prefix} Summary Extra Type`, {
    properties: [
      { name: 'state', type: 'string', required: false },
      { name: 'notes', type: 'string', required: false },
    ],
  });
  const parentGuid = await createPage(request, `${prefix} Summary Extra Parent`, { parentGuid: pageTree.rootGuid });
  await updatePage(request, parentGuid, { boardConfig: { targetTypeGuid: typeGuid, defaultView: 'board' } });
  const cardTitle = `${prefix} Summary Extra Card`;
  const cardGuid = await createPage(request, cardTitle, {
    parentGuid,
    pageType: typeGuid,
    properties: { state: { type: 'string', value: 'To Do' }, notes: { type: 'string', value: 'original' } },
  });

  try {
    await page.goto(`/pages/${parentGuid}`);
    const column = page.locator('wiki-board-column', { hasText: 'To Do' });
    await column.getByRole('button', { name: cardTitle }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: cardTitle });
    const saveBtn = dialog.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeDisabled();

    await dialog.getByLabel('notes').fill('updated notes');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(dialog).toBeHidden();

    // Re-open and open the full editor.
    await column.getByRole('button', { name: cardTitle }).click();
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('dialog').filter({ hasText: cardTitle }).getByRole('button', { name: 'Open full editor' }).click(),
    ]);
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain(`/pages/${cardGuid}`);
  } finally {
    await deletePageType(request, typeGuid);
  }
});
```

- [ ] **Step 2: Run the full file**

Run: `cd e2e && npx playwright test board-view-functional.spec.ts`
Expected: 2/2 pass (1 existing + 1 new).

- [ ] **Step 3: Update `phase-5-board/README.md`'s exit criteria**

Tick all 6 boxes `[x]`, matching Phase 1b's close-out style. Note item 6 as
"extends an existing spec" rather than implying it's wholly new.

- [ ] **Step 4: Update the top-level status board** (only if not already
  done this session by another phase plan — check git log first).

- [ ] **Step 5: Full-suite regression check**

Run: `cd e2e && npx playwright test`
Expected: all prior + all new Phase 5 specs pass. This is the slowest
full-suite run of any phase plan in this roadmap (pagination fixture alone);
budget accordingly, and don't shrink `test.setTimeout()` values to make CI
"feel" faster.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/board-view-functional.spec.ts \
  docs/flows/angular-parity-plan/phase-5-board/README.md \
  docs/flows/angular-parity-plan/README.md
git commit -m "$(cat <<'EOF'
test(e2e): extend Card Summary coverage, close Phase 5's manual-walkthrough debt (item 6)

Plan: docs/superpowers/plans/2026-09-20-phase-5-board-e2e.md
EOF
)"
```

---

## Self-Review Notes

- **This plan has the highest total flake/cost risk of the five** — two
  distinct CDK drag geometries (cross-column, within-column) plus a 201-page
  fixture. Whoever executes this should expect Tasks 4 and 5 to need at
  least one stabilization pass each (per their own `--repeat-each` steps)
  before calling them done, and should not skip Task 2's batching
  discipline even under time pressure.
- Task 6's assumption about how Board Settings becomes reachable (does
  `boardConfig.defaultView: 'board'` alone land in board mode, or is an
  explicit toggle click always required) is flagged as unverified — resolve
  it in that task's own Step 2, don't carry the assumption into Task 7.
- If Phase 2's plan hasn't landed yet when this one executes, Task 1's
  `dragCardToColumn` stands alone (no shared-helper conflict); if it has
  landed, still add `dragCardToColumn` as its own function (board and tree
  drop targets are structurally different) rather than trying to
  force-unify with `dragToRowZone`.
