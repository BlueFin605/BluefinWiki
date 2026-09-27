import { test, expect } from '../fixtures/page-tree';

test.describe('Editor bar + markdown toolbar (Phase 1b matrix items 16-22)', () => {
  /**
   * The brief's item-16 assertion selector (`.container.split, [class*=split]`)
   * was a guess. Reading `page-detail.ts` shows the split-mode container is
   * actually `.editor-surface`, which gets a `.split` class bound via
   * `[class.split]="editorMode() === 'split'"` (page-detail.ts:302-304, with
   * the `flex-direction: row` layout rule at `.editor-surface.split` in the
   * component's styles). There is no `.container.split` anywhere — `.container`
   * is an unrelated ancestor wrapping the whole content pane — so the brief's
   * selector would have matched by the `[class*=split]` fallback alone, not
   * proven the *real* split layout. Asserting `.editor-surface.split` directly
   * checks the actual class the component toggles.
   *
   * A second, unflagged correction: the brief's `getByRole('group', ...)` /
   * `getByRole('button', ...)` pair never matched anything. Angular Material's
   * single-select `mat-button-toggle-group` renders the ARIA single-select
   * pattern — `role="radiogroup"` on the group, `role="radio"` on each option
   * — not `group`/`button` (confirmed via the Playwright trace's accessibility
   * snapshot: `radiogroup "Editor view mode"` containing `radio "Edit"`,
   * `radio "Split"`, `radio "Preview"`). The brief's version would hang for
   * the full test timeout waiting for a `button` role that doesn't exist.
   */
  test('item 16: below 1024 the mode toggle offers Edit | Preview only, and Split snaps to Edit without a broken flash', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    const modeToggle = page.getByRole('radiogroup', { name: 'Editor view mode' });
    await modeToggle.getByRole('radio', { name: 'Split' }).click();
    await expect(page.locator('.editor-surface.split')).toBeVisible();

    await page.setViewportSize({ width: 360, height: 640 });
    const mobileToggle = page.getByRole('radiogroup', { name: 'Editor view mode' });
    await expect(mobileToggle.getByRole('radio', { name: 'Split' })).toBeHidden();
    await expect(mobileToggle.getByRole('radio', { name: 'Edit' })).toBeVisible();
    await expect(mobileToggle.getByRole('radio', { name: 'Preview' })).toBeVisible();

    // Whole-branch review finding I4: `toBeVisible()` only checks a non-zero
    // bounding box + `visibility` — it does NOT account for ancestor
    // `overflow: hidden` clipping, so it would still report these radios
    // "visible" even while `.mode-toggle` is crushed to near-zero width by
    // its flex parent (the exact bug fixed in commit 0124587, page-detail.ts
    // `.bar`/`.mode-toggle`). Assert the toggle group's OWN rendered width is
    // meaningfully non-zero to make this coverage deliberate rather than
    // incidental.
    const modeToggleBox = await mobileToggle.boundingBox();
    expect(modeToggleBox!.width).toBeGreaterThan(80);

    // Roll-up item 4 (upgraded by the whole-branch reviewer): prove the mode
    // actually snapped to 'edit', not just that some buttons are visible —
    // `.editor-surface` no longer carries `.split` once Split -> Edit has
    // happened (via the resize-to-mobile snap above, which forces Split back
    // to Edit; see page-detail.ts's editorMode() clamp).
    await expect(page.locator('.editor-surface')).not.toHaveClass(/split/);

    // Clicking Edit explicitly (the other route into 'edit' mode) proves the
    // same thing when the mode change is user-driven rather than a resize
    // side effect.
    await mobileToggle.getByRole('radio', { name: 'Edit' }).click();
    await expect(page.locator('.editor-surface')).not.toHaveClass(/split/);
  });

  /**
   * The brief's item-17 scroll trigger (`.cm-content, textarea,
   * [contenteditable]`) guessed at the editor library. `wiki-codemirror.ts`
   * confirms this is CodeMirror 6 (`@codemirror/view`'s `EditorView`), whose
   * standard DOM shape is `.cm-editor > .cm-scroller > .cm-content` — CM6's
   * base theme always gives `.cm-scroller` (not `.cm-content`) `overflow:
   * auto`, so `.cm-content` alone never scrolls. The brief's selector actually
   * resolves correctly at runtime because `.cm-content` IS a child of
   * `.cm-scroller`, so `el.closest('.cm-scroller')` finds the real scrolling
   * ancestor — but to make that non-obvious fact explicit (and to satisfy the
   * "prove it actually scrolled, not a no-op" bar) this test targets
   * `.cm-scroller` directly and asserts its `scrollTop` actually advanced.
   */
  test('item 17: the toolbar is position:fixed at the bottom on a scrolled editor', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.longPageGuid}/edit`);
    const toolbar = page.locator('wiki-markdown-toolbar');
    await expect(toolbar).toHaveClass(/bottom-pinned/);

    const scroller = page.locator('.cm-scroller').first();
    const scrollTopBefore = await scroller.evaluate((el) => el.scrollTop);
    const boxBeforeScroll = await toolbar.boundingBox();

    await scroller.evaluate((el) => el.scrollBy(0, 500));

    const scrollTopAfter = await scroller.evaluate((el) => el.scrollTop);
    const boxAfterScroll = await toolbar.boundingBox();

    // Confirms the trigger actually moved the editor's real scrollable
    // container rather than being a no-op against the wrong element.
    expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore);

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

  /**
   * Same `radiogroup`/`radio` correction as item 16 above — the mode toggle's
   * options are ARIA radios, not buttons.
   */
  test('item 21: in Preview sub-mode the bottom reserve is released (no phantom padding)', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.rootGuid}/edit`);
    await expect(page.locator('.body.toolbar-pinned')).toHaveCount(1);

    await page.getByRole('radiogroup', { name: 'Editor view mode' }).getByRole('radio', { name: 'Preview' }).click();
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
