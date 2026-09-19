# Phase 1b Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 1b's outstanding 32-item manual browser-walkthrough with a repeatable Playwright Test suite that runs against the already-running local dev stack.

**Architecture:** A new top-level `e2e/` package (sibling to `frontend/` and `backend/`) with its own `package.json`/`playwright.config.ts`. Tests hit `http://localhost:5173` (the Angular app) and create/tear down fixture data by calling the backend API directly at `http://localhost:3000` with the local-dev mock-admin bearer token. Every layout claim is asserted via real `getBoundingClientRect()` / `getComputedStyle()` / `document.elementFromPoint()` values from an actual Chromium layout engine — not screenshots, not jsdom.

**Tech Stack:** `@playwright/test` 1.63.0, TypeScript, Chromium (headless by default, headed available via `--headed`).

## Global Constraints

- Assumes the Aspire dev stack is already running (`dotnet run --project aspire/BlueFinWiki.AppHost` from repo root) — no `webServer` auto-start in `playwright.config.ts`, per the approved design spec.
- No CI wiring in this pass — local-only, per the approved design spec.
- Fixture pages are created via the backend API in a worker-scoped fixture, tagged with a run-scoped prefix, and deleted in teardown — no manual seeding, no shared mutable fixture data.
- Auth: local dev backend (`NODE_ENV=development`, `COGNITO_USER_POOL_ID` starting `local_`) accepts `Authorization: Bearer mock-jwt-token` and treats the caller as the mock Admin user (`backend/src/middleware/auth.ts:87-96`) — this is the exact token the frontend itself uses when `environment.disableAuth` is `true` (`frontend/src/app/core/auth/auth.ts:57-58`).
- Every matrix item maps to a named test (`item N: ...`) so the mapping from the original review (`.superpowers/sdd/phase-1b-review.md`) to test code stays traceable.
- Commit messages must reference this plan (`Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md`), per the parity plan's existing convention.

---

### Task 1: Scaffold the `e2e/` package and prove the harness works

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/tsconfig.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/tests/smoke.spec.ts`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Produces: `e2e/playwright.config.ts`'s `baseURL: 'http://localhost:5173'`, consumed by every later spec file's relative `page.goto()` calls.

- [ ] **Step 1: Create the package manifest**

`e2e/package.json`:
```json
{
  "name": "bluefinwiki-e2e",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0"
  }
}
```

- [ ] **Step 2: Create the TypeScript config**

`e2e/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@playwright/test"]
  },
  "include": ["tests/**/*.ts", "fixtures/**/*.ts", "playwright.config.ts"]
}
```

- [ ] **Step 3: Create the Playwright config**

`e2e/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
});
```

- [ ] **Step 4: Install dependencies and the Chromium browser binary**

Run (from `e2e/`):
```bash
cd e2e
npm install
npx playwright install chromium
```
Expected: `node_modules/@playwright/test` exists; Playwright reports Chromium downloaded.

- [ ] **Step 5: Write the smoke test**

`e2e/tests/smoke.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('the app shell loads against the running dev stack', async ({ page }) => {
  await page.goto('/pages');
  await expect(page.getByText('BluefinWiki')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New page' })).toBeVisible();
});
```

- [ ] **Step 6: Run it against the live stack**

Confirm the Aspire stack is running first (`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173` should print `200`), then:
```bash
cd e2e
npx playwright test smoke.spec.ts
```
Expected: `1 passed`.

- [ ] **Step 7: Ignore Playwright's local output directories**

Add to the repo root `.gitignore` (append; do not remove existing entries):
```
# Playwright (e2e/)
e2e/node_modules/
e2e/test-results/
e2e/playwright-report/
e2e/.cache/
```

- [ ] **Step 8: Commit**

```bash
git add e2e/package.json e2e/tsconfig.json e2e/playwright.config.ts e2e/tests/smoke.spec.ts .gitignore e2e/package-lock.json
git commit -m "$(cat <<'EOF'
test(e2e): scaffold Playwright package with a smoke test

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 2: Shared fixtures and UI helpers

**Files:**
- Create: `e2e/fixtures/page-tree.ts`
- Create: `e2e/tests/helpers.ts`
- Create: `e2e/tests/fixtures.spec.ts`

**Interfaces:**
- Consumes: nothing beyond Task 1's `playwright.config.ts` and Node's global `fetch` (Node 22, per `backend/package.json`'s `engines.node`).
- Produces (for Tasks 3-8):
  - `PageFixtureTree { runId: string; rootGuid: string; childGuid: string; grandchildGuid: string; greatGrandchildGuid: string; longPageGuid: string }`
  - `test` and `expect` re-exported from `e2e/fixtures/page-tree.ts`, used as `import { test, expect } from '../fixtures/page-tree'` in every later spec file, giving access to the `pageTree` fixture.
  - `openTreeDrawer(page)`, `openAiOverlay(page)`, `toggleInspector(page)`, `openSearch(page)` from `e2e/tests/helpers.ts`.

- [ ] **Step 1: Write the fixture module**

`e2e/fixtures/page-tree.ts`:
```typescript
import { test as base, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3000';
const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token' };

export interface PageFixtureTree {
  runId: string;
  rootGuid: string;
  childGuid: string;
  grandchildGuid: string;
  greatGrandchildGuid: string;
  longPageGuid: string;
}

const LONG_PAGE_CONTENT = `# Long Page

## Getting Started

Intro text for the getting-started section.

### Prerequisites

Prerequisite text.

## Architecture

Architecture overview text.

### Backend

Backend details.

### Frontend

Frontend details.

#### Frontend Build

Build pipeline notes.

## Deployment

Deployment process notes.

### Staging

Staging environment notes.

### Production

Production environment notes.

## Troubleshooting

Common issues and fixes.

## FAQ

Frequently asked questions.

## Glossary

Term definitions.

## Appendix

This is the final section, marking the end of the document for scroll testing.
`;

export async function createPage(
  request: import('@playwright/test').APIRequestContext,
  title: string,
  opts: { parentGuid?: string | null; content?: string } = {},
): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/pages`, {
    headers: AUTH_HEADER,
    data: {
      title,
      content: opts.content ?? `# ${title}`,
      parentGuid: opts.parentGuid ?? null,
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create page "${title}": ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { guid: string };
  return body.guid;
}

export async function deletePageRecursive(
  request: import('@playwright/test').APIRequestContext,
  guid: string,
): Promise<void> {
  await request.delete(`${API_BASE_URL}/pages/${guid}?recursive=true`, { headers: AUTH_HEADER });
}

export const test = base.extend<object, { pageTree: PageFixtureTree }>({
  pageTree: [
    async ({ playwright }, use) => {
      const api = await playwright.request.newContext();
      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const prefix = `E2E-${runId}`;

      const rootGuid = await createPage(api, `${prefix} Root`);
      const childGuid = await createPage(api, `${prefix} Child`, { parentGuid: rootGuid });
      const grandchildGuid = await createPage(api, `${prefix} Grandchild`, { parentGuid: childGuid });
      const greatGrandchildGuid = await createPage(api, `${prefix} Great-grandchild`, {
        parentGuid: grandchildGuid,
      });
      const longPageGuid = await createPage(api, `${prefix} Long Page`, {
        parentGuid: rootGuid,
        content: LONG_PAGE_CONTENT,
      });

      await use({ runId, rootGuid, childGuid, grandchildGuid, greatGrandchildGuid, longPageGuid });

      await deletePageRecursive(api, rootGuid);
      await api.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect };
```

- [ ] **Step 2: Write the UI helpers module**

`e2e/tests/helpers.ts`:
```typescript
import type { Page } from '@playwright/test';

export async function openTreeDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open navigation' }).click();
}

export async function openAiOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
}

/**
 * The inspector toggle's accessible name switches with the breakpoint
 * (`page-detail.ts`: `'Toggle inspector'` on desktop, `'Page info'` below
 * 1024) — this helper works at either width.
 */
export async function toggleInspector(page: Page): Promise<void> {
  const desktopButton = page.getByRole('button', { name: 'Toggle inspector' });
  if (await desktopButton.count()) {
    await desktopButton.click();
    return;
  }
  await page.getByRole('button', { name: 'Page info' }).click();
}

export async function openSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
}
```

- [ ] **Step 3: Write a test proving the fixture creates and cleans up correctly**

`e2e/tests/fixtures.spec.ts`:
```typescript
import { test as base, expect } from '@playwright/test';
import { createPage, deletePageRecursive } from '../fixtures/page-tree';

const API_BASE_URL = 'http://localhost:3000';
const AUTH_HEADER = { Authorization: 'Bearer mock-jwt-token' };

base(
  'createPage/deletePageRecursive round-trip: created page is reachable, then gone after delete',
  async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const title = `E2E-fixture-check-${Date.now()}`;

    const guid = await createPage(api, title);
    const getRes = await api.get(`${API_BASE_URL}/pages/${guid}`, { headers: AUTH_HEADER });
    expect(getRes.status()).toBe(200);
    const body = (await getRes.json()) as { title: string };
    expect(body.title).toBe(title);

    await deletePageRecursive(api, guid);
    const getAfterDelete = await api.get(`${API_BASE_URL}/pages/${guid}`, { headers: AUTH_HEADER });
    expect(getAfterDelete.status()).toBe(404);

    await api.dispose();
  },
);
```

- [ ] **Step 4: Run it**

```bash
cd e2e
npx playwright test fixtures.spec.ts
```
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/page-tree.ts e2e/tests/helpers.ts e2e/tests/fixtures.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add page-tree fixture and shared UI helpers

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 3: `tree-drawer.spec.ts` (items 12-15) — the flagship regression proof

**Files:**
- Create: `e2e/tests/tree-drawer.spec.ts`
- Temporarily modify (Step 1 only, reverted in Step 3): `frontend/src/app/features/pages/pages-view.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`PageFixtureTree` from `../fixtures/page-tree`; `openTreeDrawer` from `./helpers`.

- [ ] **Step 1: Reintroduce the regression to prove the test catches it (RED)**

Temporarily edit `frontend/src/app/features/pages/pages-view.ts`: find the `.body .sidebar { ... }` rule (around line 264) and add back the line that caused today's bug:
```typescript
    .body .sidebar {
      background: #f9fafb;
      width: min(85vw, 320px);
      position: relative;
    }
```
(Also add `position: relative;` back into the neighboring `.body .inspector { ... }` rule the same way — both were affected.)

Save. The Aspire-managed `ng serve` resource should pick this up automatically; if a previous session's `ng serve` instance is stuck not detecting file changes (as happened earlier), restart the `frontend` resource from the Aspire dashboard (`http://localhost:15888` → Resources → `frontend` row → `...` → Restart) before continuing.

- [ ] **Step 2: Write the drawer-height test and confirm it fails**

`e2e/tests/tree-drawer.spec.ts`:
```typescript
import { test, expect } from '../fixtures/page-tree';
import { openTreeDrawer } from './helpers';

test.describe('Tree drawer (Phase 1b matrix items 12-15)', () => {
  test('item 12/29: the tree drawer fills the full height of its container on desktop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    const sidenavBox = await page.locator('mat-sidenav.sidebar').boundingBox();
    const containerBox = await page.locator('mat-sidenav-container.body').boundingBox();

    expect(sidenavBox).not.toBeNull();
    expect(containerBox).not.toBeNull();
    // The drawer must fill the container's height. This is the exact bug a
    // live manual walkthrough found: `position: relative` on `.body .sidebar`
    // had higher specificity than, and silently overrode, Angular Material's
    // own `.mat-drawer { position: absolute; top: 0; bottom: 0; }` rule,
    // collapsing the drawer to its content's height (~74px) instead of the
    // container's full height (~650px+).
    expect(sidenavBox!.height).toBeGreaterThan(containerBox!.height - 2);
  });

  test('item 12: hamburger only appears below 1024 and opens the drawer at min(85vw, 320px)', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await openTreeDrawer(page);

    const sidenav = page.locator('mat-sidenav.sidebar');
    await expect(sidenav).toHaveClass(/mat-drawer-opened/);
    const box = await sidenav.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(320);
    expect(box!.width).toBeCloseTo(Math.min(0.85 * 360, 320), 0);
  });

  test('item 13: selecting a page closes the drawer; a backdrop tap closes it too', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await openTreeDrawer(page);
    await page.getByRole('tree').getByText(`${pageTree.runId} Child`).click();
    await expect(page.locator('mat-sidenav.sidebar')).not.toHaveClass(/mat-drawer-opened/);

    await openTreeDrawer(page);
    await page.locator('.mat-drawer-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('mat-sidenav.sidebar')).not.toHaveClass(/mat-drawer-opened/);
  });

  test('item 14: desktop→mobile→desktop flip re-pins the tree with no backdrop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await expect(page.locator('mat-sidenav.sidebar')).toHaveClass(/mat-drawer-side/);

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.locator('mat-sidenav.sidebar')).not.toHaveClass(/mat-drawer-side/);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('mat-sidenav.sidebar')).toHaveClass(/mat-drawer-side/);
    await expect(page.locator('.mat-drawer-backdrop')).toHaveCount(0);
  });

  test('item 15: the mobile hamburger button carries no dead/unbacked CSS class', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    const hamburger = page.getByRole('button', { name: 'Open navigation' });
    await expect(hamburger).toBeVisible();
    const classAttr = await hamburger.getAttribute('class');
    // 1b whole-branch review roll-up 1b.4-b: a `class="hamburger"` attribute
    // existed with no backing CSS rule anywhere. It was removed rather than
    // given a rule (title-centering was not pursued for React parity). This
    // asserts that cleanup holds — no `hamburger` token reappears.
    expect(classAttr ?? '').not.toMatch(/\bhamburger\b/);
    await expect(page.locator('.topbar .title')).toBeVisible();
  });
});
```

Run:
```bash
cd e2e
npx playwright test tree-drawer.spec.ts -g "item 12/29"
```
Expected: **FAIL** — `sidenavBox!.height` is small (~74) while `containerBox!.height` is large (~650+), so the `toBeGreaterThan` assertion fails. This confirms the test genuinely catches the regression.

- [ ] **Step 3: Revert the temporary regression**

Undo Step 1's edit — `frontend/src/app/features/pages/pages-view.ts`'s `.body .sidebar` and `.body .inspector` rules should have no `position` declaration at all (matching the fix already applied earlier this session):
```typescript
    .body .sidebar {
      background: #f9fafb;
      /* Desktop width comes from [style.width.px]; this is the mobile drawer. */
      width: min(85vw, 320px);
      /* .tree-divider positions against this element via Material's own
         `.mat-drawer { position: absolute; top: 0; bottom: 0; }` (a duplicate
         declaration in the same rule that wins over its earlier `relative`) —
         that already makes `.mat-drawer` a positioned ancestor, so it does not
         need to be repeated here. Setting `position: relative` on this
         higher-specificity selector previously WON over Material's `absolute`
         and silently dropped the `top:0; bottom:0` stretch, collapsing the
         drawer to its content's height (manual walkthrough finding, Phase 1b). */
    }
    .body .inspector {
      background: #fff;
      /* See .body .sidebar above: no `position` override needed or wanted. */
    }
```
If the `ng serve` resource needed a restart in Step 1, restart it again the same way after this revert.

- [ ] **Step 4: Run the full file and confirm all 5 tests pass (GREEN)**

```bash
cd e2e
npx playwright test tree-drawer.spec.ts
```
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/tree-drawer.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add tree-drawer spec (Phase 1b matrix items 12-15)

Verified RED against the position:relative drawer-height regression
before confirming GREEN against the already-applied fix, proving this
suite would have caught it.

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 4: `inspector-sheet.spec.ts` (items 7-11)

**Files:**
- Create: `e2e/tests/inspector-sheet.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`PageFixtureTree` from `../fixtures/page-tree`; `toggleInspector` from `./helpers`.

- [ ] **Step 1: Write the spec**

`e2e/tests/inspector-sheet.spec.ts`:
```typescript
import { test, expect } from '../fixtures/page-tree';
import { toggleInspector } from './helpers';

test.describe('Inspector sheet (Phase 1b matrix items 7-11)', () => {
  test('item 7/8: below 1024 the info button opens a bottom sheet, full-bleed and capped at 75vh', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);

    await toggleInspector(page);
    const sheet = page.locator('mat-sidenav.inspector');
    await expect(sheet).toHaveClass(/mat-drawer-opened/);
    await expect(sheet).toHaveClass(/mobile-sheet/);

    const box = await sheet.boundingBox();
    expect(box!.width).toBeCloseTo(360, 0);
    expect(box!.height).toBeLessThanOrEqual(640 * 0.75 + 2);

    // Slides up from the bottom edge: its bottom edge sits at the viewport
    // bottom once open (the `translateY(100%)` override only applies closed).
    expect(box!.y + box!.height).toBeCloseTo(640, 0);
  });

  test('item 9: backdrop tap and Esc both dismiss the sheet', async ({ page, pageTree }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);

    await toggleInspector(page);
    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);
    await page.locator('.mat-drawer-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('mat-sidenav.inspector')).not.toHaveClass(/mat-drawer-opened/);

    await toggleInspector(page);
    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);
    await page.keyboard.press('Escape');
    await expect(page.locator('mat-sidenav.inspector')).not.toHaveClass(/mat-drawer-opened/);
  });

  test('item 10: desktop→mobile flip with the desktop inspector open does not surface a sheet', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await toggleInspector(page); // ensure open
    if (!(await page.locator('mat-sidenav.inspector').evaluate((el) => el.classList.contains('mat-drawer-opened')))) {
      await toggleInspector(page);
    }
    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.locator('mat-sidenav.inspector')).not.toHaveClass(/mobile-sheet.*mat-drawer-opened|mat-drawer-opened.*mobile-sheet/);
    await expect(page.locator('.mat-drawer-backdrop.mat-drawer-shown')).toHaveCount(0);
  });

  test('item 11 (I2 regression): rapid View↔Edit toggling on desktop never clobbers persisted inspectorVisible', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    // Ensure the desktop inspector is open and persisted.
    const isOpen = async () =>
      page.locator('mat-sidenav.inspector').evaluate((el) => el.classList.contains('mat-drawer-opened'));
    if (!(await isOpen())) await toggleInspector(page);
    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);

    // Toggle View <-> Edit several times fast — this is I2's exact blast
    // radius: a late, async `(closed)` firing after PageContext.reset() then
    // rehydrate could previously clobber `Layout.inspectorVisible` to false.
    for (let i = 0; i < 4; i++) {
      await page.goto(`/pages/${pageTree.rootGuid}/edit`);
      await page.goto(`/pages/${pageTree.rootGuid}`);
    }

    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);
    const layoutRaw = await page.evaluate(() => localStorage.getItem('bluefinwiki-layout'));
    const layout = JSON.parse(layoutRaw ?? '{}') as { inspectorVisible?: boolean };
    expect(layout.inspectorVisible).toBe(true);

    // And it survives a reload, proving persistence (not just in-memory state).
    await page.reload();
    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd e2e
npx playwright test inspector-sheet.spec.ts
```
Expected: `4 passed`. If item 11 or item 10 fails, do not weaken the assertion — investigate via `superpowers:systematic-debugging` first, since a failure here could mean either a test bug (e.g. the initial open-toggle logic) or a real regression the review predicted.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/inspector-sheet.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add inspector-sheet spec (Phase 1b matrix items 7-11)

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 5: `stacking-paint-order.spec.ts` (items 1-6)

**Files:**
- Create: `e2e/tests/stacking-paint-order.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`PageFixtureTree` from `../fixtures/page-tree`; `openAiOverlay`, `openTreeDrawer`, `toggleInspector`, `openSearch` from `./helpers`.

- [ ] **Step 1: Write the spec**

`e2e/tests/stacking-paint-order.spec.ts`:
```typescript
import { test, expect } from '../fixtures/page-tree';
import { openAiOverlay, openTreeDrawer, toggleInspector, openSearch } from './helpers';

test.describe('Stacking / paint order (Phase 1b matrix items 1-6)', () => {
  test('item 1: mobile AI overlay header (New chat, Close) is visible and clickable, not hidden behind the app toolbar', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await openAiOverlay(page);

    await expect(page.getByRole('button', { name: 'New chat' })).toBeVisible();
    // A real click that succeeds (not `{ force: true }`) proves the button is
    // both visible AND on top at its own coordinates — this is exactly the
    // class of bug C1 found (occluded by the opaque app toolbar).
    await page.getByRole('button', { name: 'Close AI assistant' }).click();
    await expect(page.getByRole('button', { name: 'Close AI assistant' })).toBeHidden();
  });

  test('item 2: mobile AI overlay is full width with no content squeeze behind it', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    const mainBoxBefore = await page.locator('.main').boundingBox();
    await openAiOverlay(page);
    const overlayBox = await page.locator('.ai-overlay').boundingBox();
    const mainBoxAfter = await page.locator('.main').boundingBox();

    expect(overlayBox!.width).toBeCloseTo(360, 0);
    expect(mainBoxAfter!.width).toBeCloseTo(mainBoxBefore!.width, 0);
  });

  test('item 3: mobile inspector sheet paints above the pinned markdown toolbar', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    await expect(page.locator('wiki-markdown-toolbar')).toHaveClass(/bottom-pinned/);

    await toggleInspector(page);
    const sheet = page.locator('mat-sidenav.inspector');
    await expect(sheet).toHaveClass(/mat-drawer-opened/);

    const toolbarBox = await page.locator('wiki-markdown-toolbar').boundingBox();
    // Sample a point inside the toolbar's own box; if the sheet genuinely
    // paints above it, that point resolves (via elementFromPoint) to
    // something inside the sheet, not the toolbar.
    const topElementTag = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('mat-sidenav.inspector') != null,
      [toolbarBox!.x + toolbarBox!.width / 2, toolbarBox!.y + toolbarBox!.height / 2] as const,
    );
    expect(topElementTag).toBe(true);
  });

  test('item 4 (D9/I3): opening the inspector sheet while the tree drawer is open closes the drawer, one backdrop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);

    await openTreeDrawer(page);
    await expect(page.locator('mat-sidenav.sidebar')).toHaveClass(/mat-drawer-opened/);

    await toggleInspector(page);
    await expect(page.locator('mat-sidenav.inspector')).toHaveClass(/mat-drawer-opened/);
    await expect(page.locator('mat-sidenav.sidebar')).not.toHaveClass(/mat-drawer-opened/);
    await expect(page.locator('.mat-drawer-backdrop.mat-drawer-shown')).toHaveCount(1);
  });

  test('item 5 (D9/I3): opening the tree drawer while the AI overlay is open closes the overlay', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await openAiOverlay(page);
    await expect(page.locator('.ai-overlay')).toBeVisible();

    await openTreeDrawer(page);
    await expect(page.locator('mat-sidenav.sidebar')).toHaveClass(/mat-drawer-opened/);
    await expect(page.locator('.ai-overlay')).toHaveCount(0);
  });

  test('item 6: the search dialog opens above the AI overlay', async ({ page, pageTree }) => {
    await page.setViewportSize({ width: 800, height: 1000 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await openAiOverlay(page);
    await openSearch(page);

    await expect(page.getByRole('dialog', { name: 'Search wiki' })).toBeVisible();
    // A real click succeeding proves the dialog's own close control is on top
    // of everything, including the AI overlay.
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(page.getByRole('dialog', { name: 'Search wiki' })).toBeHidden();
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd e2e
npx playwright test stacking-paint-order.spec.ts
```
Expected: `6 passed`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/stacking-paint-order.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add stacking-paint-order spec (Phase 1b matrix items 1-6)

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 6: `editor-toolbar.spec.ts` (items 16-22)

**Files:**
- Create: `e2e/tests/editor-toolbar.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`PageFixtureTree` from `../fixtures/page-tree`.

- [ ] **Step 1: Write the spec**

`e2e/tests/editor-toolbar.spec.ts`:
```typescript
import { test, expect } from '../fixtures/page-tree';

test.describe('Editor bar + markdown toolbar (Phase 1b matrix items 16-22)', () => {
  test('item 16: below 1024 the mode toggle offers Edit | Preview only, and Split snaps to Edit without a broken flash', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    const modeToggle = page.getByRole('group', { name: 'Editor view mode' });
    await modeToggle.getByRole('button', { name: 'Split' }).click();
    await expect(page.locator('.container.split, [class*=split]').first()).toBeVisible();

    await page.setViewportSize({ width: 360, height: 640 });
    const mobileToggle = page.getByRole('group', { name: 'Editor view mode' });
    await expect(mobileToggle.getByRole('button', { name: 'Split' })).toBeHidden();
    await expect(mobileToggle.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(mobileToggle.getByRole('button', { name: 'Preview' })).toBeVisible();
  });

  test('item 17: the toolbar is position:fixed at the bottom on a scrolled editor', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.longPageGuid}/edit`);
    const toolbar = page.locator('wiki-markdown-toolbar');
    await expect(toolbar).toHaveClass(/bottom-pinned/);

    const boxBeforeScroll = await toolbar.boundingBox();
    await page.locator('.cm-content, textarea, [contenteditable]').first().evaluate((el) => {
      (el.closest('.cm-scroller') ?? el).scrollBy?.(0, 500);
    });
    await page.mouse.wheel(0, 500);
    const boxAfterScroll = await toolbar.boundingBox();

    // position: sticky would move with scroll; position: fixed keeps the same
    // viewport-relative box regardless of how far the editor has scrolled.
    expect(boxAfterScroll!.y).toBeCloseTo(boxBeforeScroll!.y, 0);
  });

  test('item 18: the toolbar row scrolls horizontally without wrapping when compact', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    const row = page.locator('wiki-markdown-toolbar .toolbar');
    await expect(row).toHaveCSS('flex-wrap', 'nowrap');
    const overflowsHorizontally = await row.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflowsHorizontally).toBe(true);
  });

  test('item 20: the heading menu opens upward and stays fully on-screen above the pinned bar', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    await page.getByRole('button', { name: 'Heading' }).click();
    const menu = page.locator('.mat-mdc-menu-panel', { hasText: 'Heading 1' });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox!.y).toBeGreaterThanOrEqual(0);
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(640);
  });

  test('item 21: in Preview sub-mode the bottom reserve is released (no phantom padding)', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    await expect(page.locator('.body.toolbar-pinned')).toHaveCount(1);

    await page.getByRole('group', { name: 'Editor view mode' }).getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('.body.toolbar-pinned')).toHaveCount(0);
    await expect(page.locator('wiki-markdown-toolbar')).toHaveCount(0);
  });

  test('item 22: the compact heading menu offers Heading 1-3 only', async ({ page, pageTree }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    await page.getByRole('button', { name: 'Heading' }).click();
    const menu = page.locator('.mat-mdc-menu-panel', { hasText: 'Heading 1' });
    await expect(menu.getByText('Heading 1', { exact: true })).toBeVisible();
    await expect(menu.getByText('Heading 2', { exact: true })).toBeVisible();
    await expect(menu.getByText('Heading 3', { exact: true })).toBeVisible();
    await expect(menu.getByText('Heading 4', { exact: true })).toHaveCount(0);
    await expect(menu.getByText('Heading 5', { exact: true })).toHaveCount(0);
    await expect(menu.getByText('Heading 6', { exact: true })).toHaveCount(0);
  });

  test('item 19 (accepted partial coverage): the bottom reserve references env(safe-area-inset-bottom) and content can scroll clear of the toolbar', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    const bodyPaddingBottom = await page.locator('.body.toolbar-pinned').evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.paddingBottom;
    });
    // Chromium headless cannot simulate a real notched-device inset (no true
    // safe-area compositor), so this checks the CSS contract rather than a
    // nonzero inset value: the reserve is present and at least the ~56px
    // Material icon-button-row estimate (page-detail.ts:411-414).
    expect(parseFloat(bodyPaddingBottom)).toBeGreaterThanOrEqual(56);
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd e2e
npx playwright test editor-toolbar.spec.ts
```
Expected: `7 passed`. If item 16's `.container.split, [class*=split]` selector or item 17's scroll-container selector don't match anything real, inspect the rendered DOM (`npx playwright test editor-toolbar.spec.ts --headed --debug`) and adjust the selector to the actual class/structure — these two are the only two tests in this file built from inference rather than a confirmed selector.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/editor-toolbar.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add editor-toolbar spec (Phase 1b matrix items 16-22, 19)

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 7: `toc-breadcrumbs.spec.ts` (items 23-26)

**Files:**
- Create: `e2e/tests/toc-breadcrumbs.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`PageFixtureTree` from `../fixtures/page-tree`.

- [ ] **Step 1: Write the spec**

`e2e/tests/toc-breadcrumbs.spec.ts`:
```typescript
import { test, expect } from '../fixtures/page-tree';

test.describe('TOC (Phase 1b matrix items 23-25) and breadcrumbs (item 26)', () => {
  test('item 23: below 1024 the TOC is a full-width collapsed bar above the content, not a right rail', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.longPageGuid}`);
    // `wiki-toc` (frontend/src/app/shared/markdown/table-of-contents.ts):
    // compact mode renders `<nav class="wiki-toc compact">` with a
    // `.wiki-toc-bar` toggle button reading exactly "On this page".
    const toc = page.locator('wiki-toc');
    await expect(toc).toHaveClass(/compact/);
    const bar = toc.getByRole('button', { name: 'On this page' });
    await expect(bar).toBeVisible();
    const tocBox = await toc.boundingBox();
    const contentBox = await page.locator('.main').boundingBox();
    expect(tocBox!.width).toBeCloseTo(contentBox!.width, -1);
  });

  test('item 24: expanding the TOC and picking an entry smooth-scrolls and re-collapses the bar', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.longPageGuid}`);
    const bar = page.locator('wiki-toc').getByRole('button', { name: 'On this page' });
    await bar.click();
    await expect(bar).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('link', { name: 'Architecture', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Architecture', exact: true })).toBeInViewport();
    // Picking an entry re-collapses the bar (table-of-contents.ts:44-49).
    await expect(bar).toHaveAttribute('aria-expanded', 'false');
  });

  test('item 25: at 1024+ the TOC is a sticky right rail and tracks the active heading on scroll', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.longPageGuid}`);
    const toc = page.locator('wiki-toc');
    await expect(toc).toBeVisible();
    await expect(toc).not.toHaveClass(/compact/);
    await expect(toc).toHaveCSS('position', 'sticky');

    await page.getByRole('heading', { name: 'Deployment', exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300); // IntersectionObserver settle
    // The `active` class lands on the <li>; the <a> itself carries
    // aria-current="location" (table-of-contents.ts:84-93) — assert via the
    // accessible attribute rather than the presentational class.
    const activeLink = toc.getByRole('link', { name: 'Deployment', exact: true });
    await expect(activeLink).toHaveAttribute('aria-current', 'location');
  });

  test('item 26: below 1024 breadcrumbs collapse to Home / ... / Current; the full trail returns on resize alone', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.greatGrandchildGuid}`);
    const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbs.getByText('Home')).toBeVisible();
    await expect(breadcrumbs.getByLabel('Show hidden breadcrumb segments')).toBeVisible();
    await expect(breadcrumbs.getByText(`${pageTree.runId} Child`, { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(breadcrumbs.getByLabel('Show hidden breadcrumb segments')).toHaveCount(0);
    await expect(breadcrumbs.getByText(`${pageTree.runId} Child`, { exact: true })).toBeVisible();
    await expect(breadcrumbs.getByText(`${pageTree.runId} Grandchild`, { exact: true })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd e2e
npx playwright test toc-breadcrumbs.spec.ts
```
Expected: `4 passed`. Selectors (`wiki-toc`, `.wiki-toc-bar` button text "On this page", `aria-current="location"` on the active link) are confirmed against `frontend/src/app/shared/markdown/table-of-contents.ts` directly, not inferred.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/toc-breadcrumbs.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add toc-breadcrumbs spec (Phase 1b matrix items 23-26)

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 8: `search-and-global.spec.ts` (items 27-32)

**Files:**
- Create: `e2e/tests/search-and-global.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`PageFixtureTree` from `../fixtures/page-tree`; `openSearch`, `openAiOverlay`, `openTreeDrawer`, `toggleInspector` from `./helpers`.

- [ ] **Step 1: Write the spec**

`e2e/tests/search-and-global.spec.ts`:
```typescript
import { test, expect } from '../fixtures/page-tree';
import { openSearch, openAiOverlay, openTreeDrawer, toggleInspector } from './helpers';

test.describe('Search, desktop parity, and global chrome (Phase 1b matrix items 27-32)', () => {
  test('item 27: below 1024 the search dialog is full-bleed 100vw x 100vh with square corners', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await openSearch(page);
    const pane = page.locator('.cdk-overlay-pane.fullscreen-dialog');
    await expect(pane).toBeVisible();
    const box = await pane.boundingBox();
    expect(box!.width).toBeCloseTo(360, 0);
    expect(box!.height).toBeCloseTo(640, 0);
    await expect(pane).toHaveCSS('border-radius', '0px');
  });

  test('item 28: at 1024+ the search dialog is the 640px centred card', async ({ page, pageTree }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await openSearch(page);
    const pane = page.locator('.cdk-overlay-pane').filter({ has: page.getByRole('dialog', { name: 'Search wiki' }) });
    const box = await pane.boundingBox();
    expect(box!.width).toBeCloseTo(640, 0);
    expect(box!.height).toBeLessThan(900);
  });

  test('item 29: desktop drawer/inspector borders are square and both resize dividers persist across a reload', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await expect(page.locator('mat-sidenav.sidebar')).toHaveCSS('border-top-right-radius', '0px');
    if (!(await page.locator('mat-sidenav.inspector').evaluate((el) => el.classList.contains('mat-drawer-opened')))) {
      await toggleInspector(page);
    }
    await expect(page.locator('mat-sidenav.inspector')).toHaveCSS('border-top-left-radius', '0px');

    const divider = page.locator('.tree-divider [role="separator"]');
    const box = await divider.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 60, box!.y + box!.height / 2);
    await page.mouse.up();

    const widthAfterDrag = (await page.locator('mat-sidenav.sidebar').boundingBox())!.width;
    await page.reload();
    const widthAfterReload = (await page.locator('mat-sidenav.sidebar').boundingBox())!.width;
    expect(widthAfterReload).toBeCloseTo(widthAfterDrag, 0);

    await expect(page.locator('.ai-pane')).toHaveCount(0);
    await openAiOverlay(page);
    // Desktop: the AI pane renders inline in mat-sidenav-content, not the
    // mobile fixed overlay.
    const aiPaneBox = await page.locator('.ai-pane').boundingBox();
    expect(aiPaneBox!.width).toBeCloseTo(400, 0);
  });

  test('item 30: no horizontal body scroll at 360, 800, or 1440 in view mode', async ({ page, pageTree }) => {
    for (const width of [360, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/pages/${pageTree.rootGuid}`);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasHorizontalScroll, `width=${width}`).toBe(false);
    }
  });

  test('item 31: /settings, /admin/*, /profile have no global toolbar, a Back to pages link, and an <h1>; /403 offers a way out', async ({
    page,
  }) => {
    for (const path of ['/settings', '/admin/page-types', '/admin/users', '/profile']) {
      await page.goto(path);
      await expect(page.locator('mat-toolbar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Back to pages' })).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
    }

    await page.goto('/403');
    await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Pages' })).toBeVisible();

    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible();
  });

  test('item 32: rotating 360x640 <-> 640x360 with the tree drawer open survives without a stuck backdrop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await openTreeDrawer(page);
    await expect(page.locator('mat-sidenav.sidebar')).toHaveClass(/mat-drawer-opened/);

    await page.setViewportSize({ width: 640, height: 360 });
    await page.setViewportSize({ width: 360, height: 640 });

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll).toBe(false);
    // Either the drawer is still cleanly open, or cleanly closed — never a
    // dangling shown backdrop with no drawer to match it.
    const backdropShown = (await page.locator('.mat-drawer-backdrop.mat-drawer-shown').count()) > 0;
    const drawerOpen = await page
      .locator('mat-sidenav.sidebar')
      .evaluate((el) => el.classList.contains('mat-drawer-opened'));
    expect(backdropShown).toBe(drawerOpen);
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd e2e
npx playwright test search-and-global.spec.ts
```
Expected: `6 passed`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/search-and-global.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add search-and-global spec (Phase 1b matrix items 27-32)

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

### Task 9: Run the full suite together and update the plan's own docs

**Files:**
- Modify: `docs/flows/angular-parity-plan/phase-1b-responsive/README.md`
- Modify: `docs/flows/angular-parity-plan/README.md`
- Modify: `.superpowers/sdd/phase-1b-review.md` (append a closing note; do not edit the original findings)

**Interfaces:**
- Consumes: nothing new — this is a verification + documentation task over Tasks 1-8's output.

- [ ] **Step 1: Run every spec file together, in parallel, to catch cross-file interference**

```bash
cd e2e
npx playwright test
```
Expected: all tests across all 8 spec files pass (Task 1's smoke test + Task 2's fixture check + 5 + 4 + 6 + 7 + 4 + 6 = 33 tests). If any test that passed in isolation fails here, it's very likely two worker-scoped `pageTree` fixtures racing on a shared resource — check for anything not scoped by `pageTree.runId` (there shouldn't be any; every fixture-derived title is prefixed per-run).

- [ ] **Step 2: Update Phase 1b's exit criteria**

In `docs/flows/angular-parity-plan/phase-1b-responsive/README.md`, find the manual-matrix-owed exit criteria section and replace the "run the manual matrix" line with:
```markdown
- [x] Manual matrix replaced by an automated Playwright suite: `e2e/tests/{stacking-paint-order,inspector-sheet,tree-drawer,editor-toolbar,toc-breadcrumbs,search-and-global}.spec.ts` (33 tests, all passing). See `docs/superpowers/specs/2026-09-19-phase-1b-playwright-e2e-design.md` for the design and `docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md` for how it was built. Run with `cd e2e && npx playwright test` against a running Aspire stack.
```

- [ ] **Step 3: Update the parent plan's status board**

In `docs/flows/angular-parity-plan/README.md`, find Phase 1b's row/status entry and mark its manual-QA column as done, referencing the same two files from Step 2.

- [ ] **Step 4: Append a closing note to the whole-branch review**

Append to the end of `.superpowers/sdd/phase-1b-review.md` (after the existing `## Assessment` section — do not edit any existing finding):
```markdown

---

## Closing note (2026-09-19)

The "manual matrix still owes the entire visual verification of the phase" line above is resolved by an automated Playwright suite instead of a human walkthrough — see `docs/superpowers/specs/2026-09-19-phase-1b-playwright-e2e-design.md` (design) and `docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md` (implementation). The suite's first test (`tree-drawer.spec.ts`, "item 12/29") was built test-first against the exact `position: relative` drawer-height regression a live manual-walkthrough attempt found in this same session — confirmed RED against the reintroduced bug, then GREEN against the fix, proving the automated approach would have caught it. 31 of the 32 matrix items get a genuine real-browser assertion; item 19's exact `env(safe-area-inset-bottom)` device behavior is checked at the CSS-contract level only (headless Chromium has no real notched-device compositor), consistent with this review's own prior judgment on the same rule (roll-up 1b.6-b).
```

- [ ] **Step 5: Commit**

```bash
git add docs/flows/angular-parity-plan/phase-1b-responsive/README.md docs/flows/angular-parity-plan/README.md .superpowers/sdd/phase-1b-review.md
git commit -m "$(cat <<'EOF'
docs(angular-parity): close Phase 1b's manual-matrix debt via Playwright

Plan: docs/superpowers/plans/2026-09-19-phase-1b-playwright-e2e.md
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** every one of the design's 6 spec files maps to a task (3-8); the fixture/helper architecture (Task 2) matches the design's "suite creates its own fixtures via API" decision; the TDD validation (Task 3) matches the design's "Validation of the approach itself" section; Task 9 closes the design's "Replacing the manual requirement" section.
- **Type consistency:** `PageFixtureTree`'s 5 fields (`rootGuid`, `childGuid`, `grandchildGuid`, `greatGrandchildGuid`, `longPageGuid`) are defined once in Task 2 and referenced by the same names in every later task (3-8) — no renaming drift.
- **Known-uncertain selectors flagged inline, not hidden:** Task 6 (item 16's split-mode container class, item 17's scroll-container) is called out explicitly in its own "Run it" step as built from inference rather than a confirmed grep hit, with a concrete next step (`--headed --debug`, then read the named source file) rather than left ambiguous. Task 7's TOC selectors were initially written from an on-screen guess, caught during self-review, and corrected against `table-of-contents.ts` directly (`wiki-toc`, `.wiki-toc-bar`, `aria-current="location"` on the active link rather than a presentational class) before this plan was finalized.
