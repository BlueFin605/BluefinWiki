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

    // The brief's original target ("Deployment") sits far enough down this
    // fixture's page that the scroll container (`section.body` in
    // page-detail.ts) hits its max scrollTop before the heading can reach the
    // observer's active band (top 30% of the viewport, per
    // ACTIVE_ROOT_MARGIN = '0px 0px -70% 0px') — the document (~1082px of
    // content) isn't tall enough relative to the 900px viewport to scroll
    // "Deployment" (initially at y≈691) up past y≈350. "Architecture"
    // (initially at y≈396) is well within the reachable range, so it is used
    // here instead; this only changes which heading is targeted; the
    // component under test (table-of-contents.ts) is untouched.
    const targetHeading = page.getByRole('heading', { name: 'Architecture', exact: true });
    await targetHeading.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    // The `active` class lands on the <li>; the <a> itself carries
    // aria-current="location" (table-of-contents.ts:84-93) — assert via the
    // accessible attribute rather than the presentational class.
    const activeLink = toc.getByRole('link', { name: 'Architecture', exact: true });
    await expect(activeLink).toHaveAttribute('aria-current', 'location');
  });

  test('item 26: below 1024 breadcrumbs collapse to Home / ... / Current; the full trail returns on resize alone', async ({
    page,
    pageTree,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/pages/${pageTree.greatGrandchildGuid}`);
    const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
    // Page titles from the `pageTree` fixture are `E2E-${runId} <Name>`
    // (`e2e/fixtures/page-tree.ts`'s `prefix`), not `${runId} <Name>` as in
    // the brief's literal snippet — that only went unnoticed elsewhere
    // because other specs match without `exact: true` (a substring match).
    // These assertions use `exact: true`, so the full `E2E-` prefix is
    // required to match the real link text.
    const childCrumb = `E2E-${pageTree.runId} Child`;
    const grandchildCrumb = `E2E-${pageTree.runId} Grandchild`;
    await expect(breadcrumbs.getByText('Home')).toBeVisible();
    await expect(breadcrumbs.getByLabel('Show hidden breadcrumb segments')).toBeVisible();
    await expect(breadcrumbs.getByText(childCrumb, { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(breadcrumbs.getByLabel('Show hidden breadcrumb segments')).toHaveCount(0);
    await expect(breadcrumbs.getByText(childCrumb, { exact: true })).toBeVisible();
    await expect(breadcrumbs.getByText(grandchildCrumb, { exact: true })).toBeVisible();
  });
});
