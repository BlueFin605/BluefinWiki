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
    // Wait for the dialog's enter animation (scale transform) to finish
    // before measuring — grabbing boundingBox() immediately after open can
    // catch it mid-transition and read a narrower, partially-animated width.
    await expect(pane).toBeVisible();
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

    // Capture the width *before* dragging so the persistence check below
    // can't pass trivially (e.g. a no-op drag leaving the width unchanged
    // both before and after reload would still satisfy a plain
    // widthAfterReload ≈ widthAfterDrag comparison).
    const widthBeforeDrag = (await page.locator('mat-sidenav.sidebar').boundingBox())!.width;

    const divider = page.locator('.tree-divider [role="separator"]');
    const box = await divider.boundingBox();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // CDK drag-drop's `cdkDragMoved` needs several incremental pointermove
    // events to register a move (like a real mouse drag) — a single jump
    // straight to the target x produced 0 emitted move deltas and left the
    // sidebar width unchanged. Stepping it in small increments mirrors real
    // pointer input and reliably fires the resize.
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + i * 6, startY, { steps: 2 });
    }
    await page.mouse.up();

    const widthAfterDrag = (await page.locator('mat-sidenav.sidebar').boundingBox())!.width;
    expect(Math.abs(widthAfterDrag - widthBeforeDrag)).toBeGreaterThan(20);

    await page.reload();
    const widthAfterReload = (await page.locator('mat-sidenav.sidebar').boundingBox())!.width;
    expect(widthAfterReload).toBeCloseTo(widthAfterDrag, 0);

    await expect(page.locator('.ai-pane')).toHaveCount(0);
    await openAiOverlay(page);
    // Desktop: the AI pane renders inline in mat-sidenav-content, not the
    // mobile fixed overlay.
    const aiPaneBox = await page.locator('.ai-pane').boundingBox();
    // `.ai-pane` is `width: 400px` with a 1px `border-left` under
    // content-box sizing, so its rendered boundingBox is legitimately 401px
    // wide — precision -1 (tolerance <5) accepts that hairline border
    // instead of demanding an exact 400.
    expect(aiPaneBox!.width).toBeCloseTo(400, -1);
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
    // Route -> its own <h1> text (from AdminBackHeader's `title` input), so
    // this loop genuinely checks each route's own heading rather than just
    // "some h1 is visible" (which would pass even on stale/leftover content).
    const routes: Array<[string, string]> = [
      ['/settings', 'Settings'],
      ['/admin/page-types', 'Page Types'],
      ['/admin/users', 'Members'],
      ['/profile', 'Profile'],
    ];
    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(page.locator('mat-toolbar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Back to pages' })).toBeVisible();
      await expect(page.locator('h1')).toHaveText(heading);
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
