import { test, expect, createPage, updatePage, deletePageRecursive } from '../fixtures/page-tree';
import { createPageType, deletePageType, allowChildTypes } from '../fixtures/page-types';
import { toggleInspector, inspector } from './helpers';

/**
 * Mirrors the real page-type shapes configured on the wiki (TV Kanban -> TV
 * Show -> Season, each carrying a `state` the board groups by) rather than
 * the generic single-property fixtures the other board-*.spec.ts files use.
 *
 * Season's `episodes` property is the regression case for the "add child
 * page" bug: TV Show never carries `episodes`, so New Page modal's
 * `buildInheritedProperties` can never inherit a value for it from the
 * parent — every Season created under a Show exercises the schema's
 * no-default seed for a `number` field (`merge-schema.ts`'s `schemaDefault`
 * seeding `''`, and `new-page-modal.ts`'s `withoutUnsetTypedProps` having to
 * strip it back out before the `POST`). Before that fix, submitting the New
 * Page modal here failed with a 400 "Validation failed" whose actual
 * culprit — `episodes` — was buried under
 * `details.properties.episodes._errors` rather than stated in the message.
 */
test.describe('TV Shows board (real page-type shapes)', () => {
  test('boards shows by state, boards a show\'s own seasons by state, and adding a season via the New Page modal succeeds with episodes left unset', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;

    const kanbanTypeGuid = await createPageType(request, `${prefix} TV Kanban`, { properties: [] });
    const showTypeGuid = await createPageType(request, `${prefix} TV Show`, {
      properties: [
        { name: 'state', type: 'string', required: true, defaultValue: 'Unwatched' },
        { name: 'genre', type: 'tags', required: false },
      ],
    });
    const seasonTypeGuid = await createPageType(request, `${prefix} Season`, {
      properties: [
        { name: 'state', type: 'string', required: true, defaultValue: 'Unwatched' },
        { name: 'episodes', type: 'number', required: false },
      ],
    });
    await allowChildTypes(request, kanbanTypeGuid, [showTypeGuid]);
    await allowChildTypes(request, showTypeGuid, [seasonTypeGuid]);

    const trackerTitle = `${prefix} TV Tracker`;
    const trackerGuid = await createPage(request, trackerTitle, {
      parentGuid: pageTree.rootGuid,
      pageType: kanbanTypeGuid,
    });
    await updatePage(request, trackerGuid, {
      boardConfig: { targetTypeGuid: showTypeGuid, defaultView: 'board' },
    });

    const severanceTitle = `${prefix} Severance`;
    const theBearTitle = `${prefix} The Bear`;
    const severanceGuid = await createPage(request, severanceTitle, {
      parentGuid: trackerGuid,
      pageType: showTypeGuid,
      properties: {
        state: { type: 'string', value: 'Watching' },
        genre: { type: 'tags', value: ['sci-fi'] },
      },
    });
    await createPage(request, theBearTitle, {
      parentGuid: trackerGuid,
      pageType: showTypeGuid,
      properties: {
        state: { type: 'string', value: 'Completed' },
        genre: { type: 'tags', value: ['drama'] },
      },
    });
    await updatePage(request, severanceGuid, {
      boardConfig: { targetTypeGuid: seasonTypeGuid, defaultView: 'board' },
    });

    const season1Title = `${prefix} Season 1`;
    await createPage(request, season1Title, {
      parentGuid: severanceGuid,
      pageType: seasonTypeGuid,
      properties: {
        state: { type: 'string', value: 'Completed' },
        episodes: { type: 'number', value: 9 },
      },
    });

    try {
      // 1. TV Tracker boards its shows, grouped by state.
      await page.goto(`/pages/${trackerGuid}`);
      const watchingColumn = page.locator('wiki-board-column', { hasText: 'Watching' });
      const completedShowColumn = page.locator('wiki-board-column', { hasText: 'Completed' });
      await expect(watchingColumn.getByRole('button', { name: severanceTitle })).toBeVisible();
      await expect(completedShowColumn.getByRole('button', { name: theBearTitle })).toBeVisible();

      // 2. Each show boards its own seasons, grouped by state.
      await page.goto(`/pages/${severanceGuid}`);
      const completedSeasonColumn = page.locator('wiki-board-column', { hasText: 'Completed' });
      await expect(completedSeasonColumn.getByRole('button', { name: season1Title })).toBeVisible();

      // 3. Add Season 2 under Severance via the real "New child page" flow —
      // the reported bug's actual repro path. Expand Root -> Tracker to
      // reach Severance's tree row (the tree does not auto-expand ancestors
      // of the active page).
      await page
        .getByRole('treeitem', { name: `${pageTree.runId} Root` })
        .getByRole('button', { name: 'Expand' })
        .click();
      await page
        .getByRole('treeitem', { name: trackerTitle })
        .getByRole('button', { name: 'Expand' })
        .click();
      await page.getByRole('treeitem', { name: severanceTitle }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'New child page' }).click();

      const season2Title = `${prefix} Season 2`;
      const modal = page.getByRole('dialog', { name: 'New page' });
      await modal.getByLabel('Title').fill(season2Title);
      await modal.getByLabel('Page type').click();
      await page.getByRole('option', { name: `${prefix} Season` }).click();
      await modal.getByRole('button', { name: 'Create' }).click();

      // Success (no "Validation failed" 400) — the modal closes and the new
      // Season's editor opens. Before the fix this request failed and the
      // modal stayed open with an error.
      await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+\/edit$/);
      await expect(modal).toBeHidden();

      // `state` inherits Severance's own value (`Watching`) — name+type match
      // wins over the schema default. `episodes` has no default and no
      // matching parent value: the *editor* still renders it (every schema
      // field gets a row, per `custom-properties-editor.ts`), but empty
      // rather than the invalid `''` that used to go out on the wire — the
      // fix strips the unset value from the `POST` body, it doesn't hide the
      // field from the UI.
      await toggleInspector(page);
      await expect(inspector(page)).toHaveClass(/mat-drawer-opened/);
      await expect(page.getByLabel('state', { exact: true })).toHaveValue('Watching');
      await expect(page.getByLabel('episodes', { exact: true })).toBeVisible();
      await expect(page.getByLabel('episodes', { exact: true })).toHaveValue('');
    } finally {
      await deletePageRecursive(request, trackerGuid);
      await deletePageType(request, seasonTypeGuid);
      await deletePageType(request, showTypeGuid);
      await deletePageType(request, kanbanTypeGuid);
    }
  });
});
