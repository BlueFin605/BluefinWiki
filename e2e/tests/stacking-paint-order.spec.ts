import { test, expect } from '../fixtures/page-tree';
import { openAiOverlay, openTreeDrawer, toggleInspector, sidebar, inspector } from './helpers';

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
    const sheet = inspector(page);
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

  /**
   * Direction matters here: the trigger action must be *opening the drawer*,
   * not opening the sheet. `onOpenTreeDrawer()` (pages-view.ts) explicitly
   * calls `this.ctx.inspectorSheetOpen.set(false)` on mobile (DESIGN.md D9 /
   * review I3) — that's the code path this exercises. The reverse direction
   * (open the drawer, then try to open the sheet) instead exercises the
   * sheet-open `effect()`, whose trigger — page-detail.ts's "Page info"
   * button, rendered inside `mat-sidenav-content` — sits behind the SAME
   * hoisted `mat-sidenav-container`'s backdrop that the drawer raises (step
   * 1b.4, DESIGN.md D3), and is provably unreachable by any real mouse or
   * keyboard interaction while the drawer is open (confirmed via a scripted
   * Playwright probe: the button's own bounding box falls entirely inside
   * the open sidebar's box, and Tab-ing forward never lands on it either).
   * This direction's trigger ("Open navigation") lives in `.topbar`, outside
   * the sidenav-container's backdrop scope entirely, so it stays reachable
   * regardless of the sheet's open state — verified empirically below, not
   * assumed.
   */
  test('item 4 (D9/I3): opening the tree drawer while the inspector sheet is open closes the sheet, one backdrop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);

    await toggleInspector(page);
    await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);

    await openTreeDrawer(page);
    await expect(sidebar(page)).toHaveClass(/mat-drawer-opened/);
    await expect(inspector(page)).not.toHaveClass(/mat-drawer-opened/);
    await expect(page.locator('.mat-drawer-backdrop.mat-drawer-shown')).toHaveCount(1);
  });

  /**
   * The hamburger ("Open navigation") stayed genuinely unreachable while
   * `.ai-overlay` was open — the overlay's z-index: 3 covers all of
   * `.topbar` (z-index: 2), including this button, with no keyboard
   * alternative (unlike search's Ctrl/Cmd+K). A first fix attempt (commit
   * 01fec56, a `.nav-toggle` class pinning just this button to z-index: 4)
   * did not work: `.topbar` is a flex item with its own non-auto z-index,
   * which per the flexbox spec makes it establish a stacking context
   * regardless of `position: static` — any z-index a descendant sets is
   * capped inside that context and can never outrank the sibling
   * `.ai-overlay` context, confirmed wrong via `elementFromPoint`. The real
   * fix (commit 2e09f76) uses the same technique the original C1 fix used
   * for the overlay itself: a second, functionally-identical "Open
   * navigation" button hoisted to be a direct sibling of `.ai-overlay`
   * (`.hamburger-toggle-floating`), mutually exclusive with `.topbar`'s own
   * copy — each gated on the opposite side of `aiOpen()`, so exactly one
   * "Open navigation" control exists in the accessibility tree at a time.
   * This test is otherwise unmodified from the brief.
   */
  test('item 5 (D9/I3): opening the tree drawer while the AI overlay is open closes the overlay', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await openAiOverlay(page);
    await expect(page.locator('.ai-overlay')).toBeVisible();

    await openTreeDrawer(page);
    await expect(sidebar(page)).toHaveClass(/mat-drawer-opened/);
    await expect(page.locator('.ai-overlay')).toHaveCount(0);
  });

  test('item 6: the search dialog opens above the AI overlay', async ({ page, pageTree }) => {
    await page.setViewportSize({ width: 800, height: 1000 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    await openAiOverlay(page);
    // Whole-branch review finding I6 (fixed in commit 655fcc0): Search is now
    // genuinely reachable via a hoisted floating button while the mobile AI
    // overlay is open — the same technique as the hamburger (item 5). Its
    // `aria-label` is "Search", same as the toolbar's own copy; the two are
    // mutually exclusive by `@if (!bp.isDesktop() && aiOpen())` in
    // `pages-view.ts`, so only one exists in the DOM at a time and this
    // resolves to whichever copy is currently rendered. A real click
    // succeeding (not the old Ctrl/Cmd+K workaround this test used to route
    // around the reachability bug) proves genuine reachability, matching how
    // item 5 already tests the analogous hamburger case with a real click.
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByRole('dialog', { name: 'Search wiki' })).toBeVisible();
    // A real click succeeding proves the dialog's own close control is on top
    // of everything, including the AI overlay.
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(page.getByRole('dialog', { name: 'Search wiki' })).toBeHidden();
  });
});
