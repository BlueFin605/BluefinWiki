import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures/page-tree';
import { toggleInspector, inspector, isDrawerOpen } from './helpers';

/**
 * The `mat-drawer-opened` class lands synchronously with the `[opened]`
 * binding, but the CSS slide transition (and the CDK focus trap that moves
 * focus into the drawer once it settles) both continue for ~400ms after that.
 * A `boundingBox()` read or an Escape keypress issued mid-transition observes
 * a still-animating box, or a keydown that never reaches the drawer's own
 * `keydown` host listener because focus hasn't moved inside it yet — neither
 * of which a real user, whose click-to-keypress reaction time exceeds the
 * transition, would ever hit. Waiting for `mat-drawer-animating` to clear
 * (Playwright's `not.toHaveClass` polls until it does) settles the sheet
 * before the test reads geometry or dispatches a dismiss key, without
 * touching what's actually being asserted.
 */
async function waitForSheetSettled(sheet: Locator): Promise<void> {
  await expect(sheet).not.toHaveClass(/mat-drawer-animating/);
}

test.describe('Inspector sheet (Phase 1b matrix items 7-11)', () => {
  test('item 7/8: below 1024 the info button opens a bottom sheet, full-bleed and capped at 75vh', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);

    await toggleInspector(page);
    const sheet = inspector(page);
    await expect(sheet).toHaveClass(/mat-drawer-opened/);
    await expect(sheet).toHaveClass(/mobile-sheet/);
    await waitForSheetSettled(sheet);

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

    const sheet = inspector(page);
    await toggleInspector(page);
    await expect(sheet).toHaveClass(/mat-drawer-opened/);
    await waitForSheetSettled(sheet);
    await page.locator('.mat-drawer-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(sheet).not.toHaveClass(/mat-drawer-opened/);

    await toggleInspector(page);
    await expect(sheet).toHaveClass(/mat-drawer-opened/);
    // Wait for the open transition (and the CDK focus trap that follows it) to
    // settle before pressing Escape: Material's drawer closes on Escape via a
    // `keydown` listener on its own host element, which only receives the
    // event once focus has moved inside it — mid-animation, focus is still on
    // the button that was just clicked, so an immediate Escape is a no-op.
    await waitForSheetSettled(sheet);
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveClass(/mat-drawer-opened/);
  });

  test('item 10: desktop→mobile flip with the desktop inspector open does not surface a sheet', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await toggleInspector(page); // ensure open
    if (!(await isDrawerOpen(inspector(page)))) {
      await toggleInspector(page);
    }
    await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(inspector(page)).not.toHaveClass(/mobile-sheet.*mat-drawer-opened|mat-drawer-opened.*mobile-sheet/);
    await expect(page.locator('.mat-drawer-backdrop.mat-drawer-shown')).toHaveCount(0);
  });

  test('item 11 (I2 regression): rapid View↔Edit toggling on desktop never clobbers persisted inspectorVisible', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}`);

    // Ensure the desktop inspector is open and persisted.
    if (!(await isDrawerOpen(inspector(page)))) await toggleInspector(page);
    await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);

    // Toggle View <-> Edit several times fast — this is I2's exact blast
    // radius: a late, async `(closed)` firing after PageContext.reset() then
    // rehydrate could previously clobber `Layout.inspectorVisible` to false.
    for (let i = 0; i < 4; i++) {
      await page.goto(`/pages/${pageTree.rootGuid}/edit`);
      await page.goto(`/pages/${pageTree.rootGuid}`);
    }

    await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);
    const layoutRaw = await page.evaluate(() => localStorage.getItem('bluefinwiki-layout'));
    const layout = JSON.parse(layoutRaw ?? '{}') as { inspectorVisible?: boolean };
    expect(layout.inspectorVisible).toBe(true);

    // And it survives a reload, proving persistence (not just in-memory state).
    await page.reload();
    await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);
  });
});
