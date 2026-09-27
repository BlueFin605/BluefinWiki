import { test, expect, createPage } from '../fixtures/page-tree';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';

test.describe('Create page from broken link', () => {
  test('clicking a broken link creates a page and rewrites the source without auto-saving', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const hostTitle = `${prefix} Broken Link Host`;
    const missingTitle = `${prefix} Missing Target`;
    const originalContent = `# ${hostTitle}\n\nSee [[${missingTitle}]] for details.`;
    const hostGuid = await createPage(request, hostTitle, {
      parentGuid: pageTree.rootGuid,
      content: originalContent,
    });

    let putFired = false;
    await page.route(`**/api/pages/${hostGuid}`, (route) => {
      if (route.request().method() === 'PUT') putFired = true;
      route.continue();
    });

    // View mode (`/pages/:guid`, mode() === 'view') renders <wiki-markdown-renderer>
    // directly -- no preview/split sub-mode to switch into first; that toggle only
    // exists on the /edit route (page-detail.ts's editorMode()).
    await page.goto(`/pages/${hostGuid}`);
    const brokenLink = page.locator('a.wiki-link-broken', { hasText: missingTitle });
    await expect(brokenLink).toBeVisible();
    await brokenLink.click();

    const modal = page.getByRole('dialog', { name: 'Create page from link' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Link updated — save the page to keep the change.')).toBeVisible();
    expect(putFired, 'the rewrite must not auto-save').toBe(false);

    // page-detail.ts's onBrokenLink() rewrote the in-memory buffer to
    // `[[newGuid|displayText]]` in place -- the preview re-renders it as a
    // normal, resolved link immediately, with no reload or save required.
    await expect(page.locator('a.wiki-link', { hasText: missingTitle })).toBeVisible();
    await expect(brokenLink).toHaveCount(0);

    // Confirm the rewrite never reached the server: the host page's raw
    // content is still the original `[[Missing Target]]` markdown, not the
    // rewritten `[[guid|...]]` form.
    //
    // A DOM-based "reload and check it's still broken" assertion can't prove
    // this here: creating the target page makes `[[Missing Target]]` resolve
    // live by title (wikiResolutions / POST /pages/links/resolve) from then
    // on, regardless of whether the source was ever rewritten -- and
    // page-detail.ts separately mirrors the working buffer into a debounced,
    // per-guid localStorage draft (Drafts) that would rehydrate on reload
    // whether or not the server was ever touched. Only a direct read of the
    // server's own copy actually proves "not persisted".
    const res = await request.get(`${API_BASE_URL}/pages/${hostGuid}`, { headers: AUTH_HEADER });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { content: string };
    expect(body.content).toBe(originalContent);
  });
});
