import { test, expect } from '../fixtures/page-tree';
import { openTreeDrawer, toggleInspector, sidebar, inspector } from './helpers';

test.describe('Tree drawer (Phase 1b matrix items 12-15)', () => {
  test('item 12/29: the tree drawer fills the full height of its container on desktop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    const sidenavBox = await sidebar(page).boundingBox();
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

    // Whole-branch review finding I1: the same `position: relative` fix
    // (commit 8fa0f97) was applied to BOTH `.body .sidebar` above AND
    // `.body .inspector` in `pages-view.ts` — reintroducing it on the
    // inspector rule alone previously flipped no test in this suite. Mirror
    // the sidebar assertion against the desktop inspector to close that gap.
    await toggleInspector(page);
    const inspectorBox = await inspector(page).boundingBox();
    expect(inspectorBox).not.toBeNull();
    expect(inspectorBox!.height).toBeGreaterThan(containerBox!.height - 2);
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

    const sidenav = sidebar(page);
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
    // The app correctly does not auto-expand ancestors of the active page
    // (out of this plan's scope) — a real tester reaches "Child" by expanding
    // Root first, so do the same here before selecting it.
    await page
      .getByRole('treeitem', { name: `${pageTree.runId} Root` })
      .getByRole('button', { name: 'Expand' })
      .click();
    await page.getByRole('tree').getByText(`${pageTree.runId} Child`).click();
    await expect(sidebar(page)).not.toHaveClass(/mat-drawer-opened/);

    await openTreeDrawer(page);
    // `.mat-drawer-backdrop` spans the full container (same top-left corner as
    // the left-anchored drawer), so a click near its own (0,0) lands inside the
    // drawer's rectangle and is intercepted by its content. Click near the
    // backdrop's right edge instead — outside the drawer's max 320px width —
    // to actually land on the exposed backdrop strip.
    const backdrop = page.locator('.mat-drawer-backdrop');
    const backdropBox = await backdrop.boundingBox();
    await backdrop.click({ position: { x: (backdropBox?.width ?? 360) - 5, y: 5 } });
    await expect(sidebar(page)).not.toHaveClass(/mat-drawer-opened/);
  });

  test('item 14: desktop→mobile→desktop flip re-pins the tree with no backdrop', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await expect(sidebar(page)).toHaveClass(/mat-drawer-side/);

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(sidebar(page)).not.toHaveClass(/mat-drawer-side/);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(sidebar(page)).toHaveClass(/mat-drawer-side/);
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
