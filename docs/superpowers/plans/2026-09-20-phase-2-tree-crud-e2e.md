# Phase 2 Tree-CRUD E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** automate the 6 still-owed manual-walkthrough exit-criteria items
for Phase 2 (drag reorder, blocked disallowed-type drop, arrow-key
expand/collapse + auto-expand-on-create, typed-parent-scoped create,
create-from-broken-link, delete-with-children confirm) as Playwright specs.
Item 4 (rename pre-fill) is **already fully covered** by
`e2e/tests/page-rename.spec.ts` — no new work for it, just confirm it stays
green.

**Architecture:** validation tests against already-shipped, whole-branch-reviewed
code (`a380e3c`). Two items (1, 2) require CDK drag-drop onto a specific
25%-height band of a *sibling* row — the one drag geometry
`e2e/tests/tree-reparent.spec.ts` deliberately avoided (its own doc comment
explains why: sibling rows share a `cdkDropListGroup` and CDK's sort-preview
transform makes re-aimed drags oscillate). This plan's Task 1 builds a
harder, purpose-built helper rather than reusing `dragOnto` as-is.

**Tech Stack:** Playwright (`e2e/`), local Aspire dev stack.

## Global Constraints

- Work happens **in place** on branch `feat/angular-rewrite` (NOT master, NO
  worktree).
- `npm test` + `npm run lint` in `frontend/` stay green (no production code
  changes expected — if a task finds a real product bug, stop and report it
  per this repo's standing pattern rather than silently patching around it
  in the test).
- Every commit's message carries a `Plan:` trailer to this file.
- Native `window.alert()` (used for the blocked-drop warning, item 2) will
  **hang Playwright** unless a `page.on('dialog', ...)` handler is
  registered before the triggering action — every task touching that path
  must register one.
- Touch-drag-drop is a known, documented, unfixed gap (see
  `phase-2-tree-crud/README.md`) — this plan covers **mouse drag only**,
  matching the phase's own exit-criteria wording ("mouse-only").

---

## File Structure

- Modify: `e2e/tests/helpers.ts` — add `dragToRowZone()` (before/after/onto-aware sibling drag)
- Create: `e2e/tests/tree-drag-reorder.spec.ts` — items 1, 2
- Create: `e2e/tests/tree-keyboard-nav.spec.ts` — item 3
- Create: `e2e/tests/tree-create-scoped.spec.ts` — item 5
- Create: `e2e/tests/broken-link-create.spec.ts` — item 6
- Create: `e2e/tests/tree-delete-confirm.spec.ts` — item 7
- Modify: `docs/flows/angular-parity-plan/phase-2-tree-crud/README.md`

---

### Task 1: `dragToRowZone()` helper

**Files:**
- Modify: `e2e/tests/helpers.ts`

**Interfaces:**
- Produces: `dragToRowZone(page: Page, source: Locator, targetRow: Locator, zone: 'before' | 'after' | 'onto'): Promise<void>`. Consumed by Task 2 (items 1, 2) and, per the roadmap doc, reusable later by Phase 5's board drag work.

`page-tree-item.ts:434-440`: a row's own rect is split top 25% = `before`,
bottom 25% = `after`, middle 50% = `onto`. Unlike `tree-reparent.spec.ts`'s
`dragOnto` (which targets a stable non-sibling `.root-drop-zone` and can
freely re-read `boundingBox()`), this helper must land inside a live
sibling's shifting quartile — so it computes the target Y **once**, before
the drag starts, and never re-reads the target's box mid-drag (re-reading is
exactly what causes the oscillation `tree-reparent.spec.ts` documents).

- [ ] **Step 1: Add the helper**

```ts
export async function dragToRowZone(
  page: Page,
  source: Locator,
  targetRow: Locator,
  zone: 'before' | 'after' | 'onto',
): Promise<void> {
  const s = await source.boundingBox();
  const t = await targetRow.boundingBox();
  if (!s || !t) throw new Error('dragToRowZone: source or target has no bounding box');

  const targetY =
    zone === 'before' ? t.y + t.height * 0.1 : zone === 'after' ? t.y + t.height * 0.9 : t.y + t.height * 0.5;
  const targetX = t.x + t.width / 2;

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 5, { steps: 5 });
  await page.waitForTimeout(100);
  // Single committed move to the pre-computed target point — no re-read of
  // targetRow's box after this point (see doc comment above).
  await page.mouse.move(targetX, targetY, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/helpers.ts
git commit -m "$(cat <<'EOF'
test(e2e): add dragToRowZone helper for before/after/onto sibling drops

Plan: docs/superpowers/plans/2026-09-20-phase-2-tree-crud-e2e.md
EOF
)"
```

(No separate test run — exercised for real by Task 2 next; committing a
helper with zero callers would violate this plan's own "no placeholders"
discipline if left standalone longer than one task.)

---

### Task 2: `tree-drag-reorder.spec.ts` (items 1, 2)

**Files:**
- Create: `e2e/tests/tree-drag-reorder.spec.ts`

**Interfaces:**
- Consumes: `dragToRowZone` (Task 1), `createPage`/`pageTree` fixture (`../fixtures/page-tree`), `createPageType`/`allowChildTypes` (`../fixtures/page-types`).

Item 1: drag a sibling above/below another → order persists after reload.
`Pages.reorderPages({parentGuid, orderedGuids})` → `PUT /api/pages/reorder`.
Verify via `GET /pages/:parent/children` order, or simpler: assert DOM row
order directly (`page.getByRole('treeitem')` list under the parent),
matching how `tree-reorder.spec.ts`'s existing context-menu-sort test
already asserts order.

Item 2: drag onto a disallowed-type parent → `.page-tree-row.drop-invalid`
amber class + `window.alert('Cannot move here:\n' + warnings)` + no PUT
fired. Requires a type hierarchy set up via `page-types.ts`'s fixtures with
`allowChildTypes` deliberately NOT including the dragged page's type.

- [ ] **Step 1: Write the reorder test (item 1)**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';
import { dragToRowZone } from './helpers';

test.describe('Tree drag reorder', () => {
  test('dragging a sibling above another persists the new order after reload', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const firstTitle = `${prefix} First`;
    const secondTitle = `${prefix} Second`;
    await createPage(request, firstTitle, { parentGuid: pageTree.rootGuid });
    await createPage(request, secondTitle, { parentGuid: pageTree.rootGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await rootRow.getByRole('button', { name: 'Expand' }).click();

    const firstRow = page.getByRole('treeitem', { name: firstTitle });
    const secondRow = page.getByRole('treeitem', { name: secondTitle });
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // Drag Second to land BEFORE First (top quartile of First's row).
    await dragToRowZone(page, secondRow, firstRow, 'before');

    const rowsAfter = page.getByRole('treeitem');
    const orderedTitles = await rowsAfter.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent));
    const secondIdx = orderedTitles.findIndex((t) => t?.includes('Second'));
    const firstIdx = orderedTitles.findIndex((t) => t?.includes('First'));
    expect(secondIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeLessThan(firstIdx);

    await page.reload();
    await rootRow.getByRole('button', { name: 'Expand' }).click().catch(() => {});
    const rowsAfterReload = page.getByRole('treeitem');
    const orderedAfterReload = await rowsAfterReload.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent));
    const secondIdx2 = orderedAfterReload.findIndex((t) => t?.includes('Second'));
    const firstIdx2 = orderedAfterReload.findIndex((t) => t?.includes('First'));
    expect(secondIdx2).toBeLessThan(firstIdx2);
  });
});
```

- [ ] **Step 2: Run it, in isolation, several times**

Run: `cd e2e && npx playwright test tree-drag-reorder.spec.ts --repeat-each=5`
Expected: 5/5 pass. This is the drag geometry the investigation flagged as
genuinely flake-prone — if it's flaky, don't just add a retry; try widening
the target zone from 10%/90% to 15%/85% first (still inside the documented
25% band, more margin for pixel rounding), and re-run before accepting any
retry as a fix.

- [ ] **Step 3: Add the blocked-drop test (item 2)**

```ts
test('dragging onto a disallowed-type parent is blocked with a warning and fires no request', async ({
  page,
  pageTree,
  request,
}) => {
  const prefix = `E2E-${pageTree.runId}`;
  const restrictedTypeGuid = await createPageType(request, `${prefix} Restricted Type`, { properties: [] });
  const otherTypeGuid = await createPageType(request, `${prefix} Other Type`, { properties: [] });
  await allowChildTypes(request, restrictedTypeGuid, [restrictedTypeGuid]); // only accepts its own type as children

  const restrictedParentTitle = `${prefix} Restricted Parent`;
  const restrictedParentGuid = await createPage(request, restrictedParentTitle, {
    parentGuid: pageTree.rootGuid,
    pageType: restrictedTypeGuid,
  });
  const movedTitle = `${prefix} Wrong Type Page`;
  await createPage(request, movedTitle, { parentGuid: pageTree.rootGuid, pageType: otherTypeGuid });

  let dialogMessage = '';
  page.on('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });

  let moveRequestFired = false;
  await page.route('**/api/pages/*/move', (route) => {
    moveRequestFired = true;
    route.continue();
  });

  await page.goto(`/pages/${pageTree.rootGuid}`);
  const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
  await rootRow.getByRole('button', { name: 'Expand' }).click();

  const movedRow = page.getByRole('treeitem', { name: movedTitle });
  const restrictedParentRow = page.getByRole('treeitem', { name: restrictedParentTitle });
  await expect(movedRow).toBeVisible();
  await expect(restrictedParentRow).toBeVisible();

  await dragToRowZone(page, movedRow, restrictedParentRow, 'onto');

  expect(dialogMessage).toContain('Cannot move here');
  expect(moveRequestFired, 'a blocked drop must not call the move endpoint').toBe(false);
  await expect(page.getByRole('treeitem', { name: movedTitle })).toBeVisible(); // still where it started
});
```

- [ ] **Step 4: Run the full file**

Run: `cd e2e && npx playwright test tree-drag-reorder.spec.ts`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/tree-drag-reorder.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add tree drag-reorder + disallowed-type-drop coverage (Phase 2 items 1-2)

Plan: docs/superpowers/plans/2026-09-20-phase-2-tree-crud-e2e.md
EOF
)"
```

---

### Task 3: `tree-keyboard-nav.spec.ts` (item 3)

**Files:**
- Create: `e2e/tests/tree-keyboard-nav.spec.ts`

**Interfaces:**
- Consumes: `createPage`/`pageTree` fixture.

Two sub-cases: (a) `ArrowRight`/`ArrowLeft` expand/collapse focused rows; (b)
creating a child auto-expands its parent (`expandTarget`/`TreeExpandTarget`
signal, `page-tree-item.ts:330-341`).

- [ ] **Step 1: Write the arrow-key case**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';

test.describe('Tree keyboard navigation', () => {
  test('ArrowRight/ArrowLeft expand and collapse a row', async ({ page, pageTree, request }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await expect(rootRow).toHaveAttribute('aria-expanded', 'false');

    await rootRow.focus();
    await rootRow.press('ArrowRight');
    await expect(rootRow).toHaveAttribute('aria-expanded', 'true');

    await rootRow.press('ArrowLeft');
    await expect(rootRow).toHaveAttribute('aria-expanded', 'false');
  });

  test('creating a child page auto-expands its parent', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);
    const rootRow = page.getByRole('treeitem', { name: `${pageTree.runId} Root` });
    await expect(rootRow).toHaveAttribute('aria-expanded', 'false');

    // Open the "New child page" flow from the root row's context menu.
    await rootRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /new (child )?page/i }).click();

    const modal = page.getByRole('dialog', { name: 'New page' });
    await modal.getByLabel('Title').fill(`${pageTree.runId} Auto-Expand Child`);
    await modal.getByRole('button', { name: 'Create' }).click();

    // Navigates to the new page's editor — wait for that, then confirm the
    // parent row (still present in the tree drawer/sidebar) is expanded.
    await page.waitForURL(/\/pages\/.+\/edit/);
    await expect(rootRow).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 2: Verify the context-menu item name before trusting Step 1**

The exact accessible name for "create a child page" in the row context menu
wasn't directly confirmed by investigation — run headed and check:

Run: `cd e2e && npx playwright test tree-keyboard-nav.spec.ts --headed -g "auto-expands"`

Adjust the `getByRole('menuitem', ...)` regex to match the real label before
proceeding (check `page-context-menu.ts` if the live DOM name is ambiguous).

- [ ] **Step 3: Run the full file**

Run: `cd e2e && npx playwright test tree-keyboard-nav.spec.ts`
Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/tree-keyboard-nav.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add tree arrow-key nav + auto-expand-on-create coverage (Phase 2 item 3)

Plan: docs/superpowers/plans/2026-09-20-phase-2-tree-crud-e2e.md
EOF
)"
```

---

### Task 4: `tree-create-scoped.spec.ts` (item 5)

**Files:**
- Create: `e2e/tests/tree-create-scoped.spec.ts`

**Interfaces:**
- Consumes: `createPageType`/`allowChildTypes` (`../fixtures/page-types`), `createPage`/`pageTree`.

`page-create-edit-save.spec.ts` already covers the untyped create flow +
`# Title` boilerplate — this task covers only the net-new parts: type
scoping in the `mat-select`, auto-select when exactly one allowed type, and
the parent-auto-expand assertion (already partially exercised by Task 3's
second test from a different angle — this one specifically checks the
type-select UI, Task 3's checks the tree-expand side).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';
import { createPageType, allowChildTypes } from '../fixtures/page-types';

test.describe('Scoped child creation', () => {
  test('a typed parent with exactly one allowed child type auto-selects it', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const parentTypeGuid = await createPageType(request, `${prefix} Parent Type`, { properties: [] });
    const onlyChildTypeGuid = await createPageType(request, `${prefix} Only Child Type`, { properties: [] });
    await allowChildTypes(request, parentTypeGuid, [onlyChildTypeGuid]);

    const parentTitle = `${prefix} Typed Parent`;
    const parentGuid = await createPage(request, parentTitle, { parentGuid: pageTree.rootGuid, pageType: parentTypeGuid });

    await page.goto(`/pages/${parentGuid}`);
    const parentRow = page.getByRole('treeitem', { name: parentTitle });
    await parentRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /new (child )?page/i }).click();

    const modal = page.getByRole('dialog', { name: 'New page' });
    // Exactly one allowed type -> the select should show it pre-selected
    // (or the select may be hidden entirely if the UI elides a single-option
    // picker -- verify against new-page-modal.ts's real conditional rendering
    // before finalizing this assertion).
    await expect(modal.getByText(`${prefix} Only Child Type`)).toBeVisible();

    await modal.getByLabel('Title').fill(`${prefix} Scoped Child`);
    await modal.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/pages\/.+\/edit/);
  });
});
```

- [ ] **Step 2: Run it and reconcile the auto-select UI assertion**

Run: `cd e2e && npx playwright test tree-create-scoped.spec.ts --headed`

The investigation confirmed the auto-select *logic* (`new-page-modal.ts:167-180`)
but not the exact rendered state when the select is hidden vs. shown with
one pre-selected option — observe the real DOM here and adjust the
assertion to match (e.g. `modal.getByLabel('Page type')` should have value
`Only Child Type` if the select renders, or skip that locator if the modal
elides it).

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/tree-create-scoped.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add type-scoped child-creation coverage (Phase 2 item 5)

Plan: docs/superpowers/plans/2026-09-20-phase-2-tree-crud-e2e.md
EOF
)"
```

---

### Task 5: `broken-link-create.spec.ts` (item 6)

**Files:**
- Create: `e2e/tests/broken-link-create.spec.ts`

**Interfaces:**
- Consumes: `createPage`/`pageTree`.

Content containing `[[NonExistentTitle]]` renders `a.wiki-link-broken`.
Clicking it opens a create-from-link modal; on create, `page-detail.ts`'s
`onBrokenLink` rewrites the CodeMirror buffer in place (**no auto-save**)
and shows a snackbar `'Link updated — save the page to keep the change.'`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';

test.describe('Create page from broken link', () => {
  test('clicking a broken link creates a page and rewrites the source without auto-saving', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const hostTitle = `${prefix} Broken Link Host`;
    const hostGuid = await createPage(request, hostTitle, {
      parentGuid: pageTree.rootGuid,
      content: `# ${hostTitle}\n\nSee [[${prefix} Missing Target]] for details.`,
    });

    let putFired = false;
    await page.route(`**/api/pages/${hostGuid}`, (route) => {
      if (route.request().method() === 'PUT') putFired = true;
      route.continue();
    });

    await page.goto(`/pages/${hostGuid}`);
    const brokenLink = page.locator('a.wiki-link-broken', { hasText: `${prefix} Missing Target` });
    await expect(brokenLink).toBeVisible();
    await brokenLink.click();

    const modal = page.getByRole('dialog', { name: 'Create page from link' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Link updated — save the page to keep the change.')).toBeVisible();
    expect(putFired, 'the rewrite must not auto-save').toBe(false);

    // Content is unsaved -- reload and confirm the raw markdown wasn't persisted.
    await page.reload();
    await expect(page.locator('a.wiki-link-broken', { hasText: `${prefix} Missing Target` })).toBeVisible();
  });
});
```

- [ ] **Step 2: Verify the page needs to be in a mode where the preview actually renders**

The broken link only renders in the markdown **preview** pane, not raw edit
mode — confirm `/pages/:guid` (view mode) or the split/preview sub-mode
renders it by default; if the default route lands in an editor-only view,
add a click on whatever toggles the preview/split pane before asserting
`brokenLink` is visible. Run headed to confirm:

Run: `cd e2e && npx playwright test broken-link-create.spec.ts --headed`

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/broken-link-create.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add create-page-from-broken-link coverage (Phase 2 item 6)

Plan: docs/superpowers/plans/2026-09-20-phase-2-tree-crud-e2e.md
EOF
)"
```

---

### Task 6: `tree-delete-confirm.spec.ts` (item 7) + doc close-out

**Files:**
- Create: `e2e/tests/tree-delete-confirm.spec.ts`
- Modify: `docs/flows/angular-parity-plan/phase-2-tree-crud/README.md`
- Modify: `docs/flows/angular-parity-plan/README.md` (only if Phase 8's plan hasn't already updated this table this session — check `git log` first, per that plan's Task 6 Step 4 note)

**Interfaces:**
- Consumes: `createPage`/`pageTree`.

Leaf copy: `'Delete this page?'`. Has-children copy: `'Delete this page and
all its child pages? This action cannot be undone.'` Server-error path via
`page.route()` returning a JSON `{message: ...}` body, surfaced via a
`MatSnackBar`.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, createPage } from '../fixtures/page-tree';

test.describe('Delete confirmation', () => {
  test('deleting a leaf page shows the leaf copy', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const leafTitle = `${prefix} Leaf To Delete`;
    await createPage(request, leafTitle, { parentGuid: pageTree.rootGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const leafRow = page.getByRole('treeitem', { name: leafTitle });
    await leafRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete page' });
    await expect(dialog.getByText('Delete this page?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('treeitem', { name: leafTitle })).toBeVisible();
  });

  test('deleting a page with children shows child-aware copy', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const parentTitle = `${prefix} Parent With Child`;
    const parentGuid = await createPage(request, parentTitle, { parentGuid: pageTree.rootGuid });
    await createPage(request, `${prefix} Its Child`, { parentGuid });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const parentRow = page.getByRole('treeitem', { name: parentTitle });
    await parentRow.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete page' });
    await expect(
      dialog.getByText('Delete this page and all its child pages? This action cannot be undone.'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('a server error on delete is surfaced', async ({ page, pageTree, request }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const title = `${prefix} Delete Error Target`;
    await createPage(request, title, { parentGuid: pageTree.rootGuid });

    await page.route('**/api/pages/*', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Simulated delete failure' }),
        });
      }
      return route.continue();
    });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    const row = page.getByRole('treeitem', { name: title });
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByRole('dialog', { name: 'Delete page' }).getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Simulated delete failure')).toBeVisible();
    await expect(page.getByRole('treeitem', { name: title })).toBeVisible(); // not removed
  });
});
```

- [ ] **Step 2: Run the full file**

Run: `cd e2e && npx playwright test tree-delete-confirm.spec.ts`
Expected: 3/3 pass. Confirm the "delete" context-menu item's accessible
name and the Admin-role gate (`canDelete`) don't block it — the mock e2e
auth user resolves to Admin (confirmed by Phase 8's investigation), so this
should be a non-issue, but verify if the menu item doesn't appear.

- [ ] **Step 3: Update `phase-2-tree-crud/README.md`'s exit criteria**

Tick all 7 boxes `[x]` (items 1-3, 5-7 newly automated; item 4 already
covered by `page-rename.spec.ts`, note that explicitly rather than
implying this plan added it), same style as Phase 1b's close-out.

- [ ] **Step 4: Update the top-level status board** (only if not already
  done by another phase plan this session — check git log first)

- [ ] **Step 5: Full-suite regression check**

Run: `cd e2e && npx playwright test`
Expected: all prior + all new Phase 2 specs pass.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/tree-delete-confirm.spec.ts \
  docs/flows/angular-parity-plan/phase-2-tree-crud/README.md \
  docs/flows/angular-parity-plan/README.md
git commit -m "$(cat <<'EOF'
test(e2e): add delete-confirmation coverage, close Phase 2's manual-walkthrough debt (item 7)

Plan: docs/superpowers/plans/2026-09-20-phase-2-tree-crud-e2e.md
EOF
)"
```

---

## Self-Review Notes

- **Task 2's item-1 drag test is the highest flake risk in this plan** —
  budget real time for Step 2's `--repeat-each=5` stabilization pass before
  moving on; if it's still flaky after widening the target band, escalate
  rather than papering over it with retries (matches this repo's standing
  "don't just increase timeouts" convention from the sibling home-repo
  debugging skill).
- Tasks 3 and 4 both have an explicit "verify against the live DOM before
  trusting this selector" step — the context-menu item name and the
  auto-select UI's exact rendered shape were not directly confirmed by
  investigation. Resolve both before considering those tasks done.
- Item 4 (rename) needs **no task** in this plan — confirm
  `e2e/tests/page-rename.spec.ts` is still green as part of Task 6's
  Step 5 full-suite run, but do not duplicate its coverage.
