import { test, expect } from '../fixtures/page-tree';
import { installLanguageModelStub } from '../fixtures/ai';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';

test.describe('AI action runner', () => {
  test('applying a create_page action actually creates the page', async ({
    page,
    pageTree,
    request,
  }) => {
    const prefix = `E2E-${pageTree.runId}`;
    const rootTitle = `${prefix} Root`;
    const newTitle = `${prefix} AI Created Page`;

    await installLanguageModelStub(page, [
      JSON.stringify({
        message: `I'll create "${newTitle}" for you.`,
        action: {
          type: 'create_page',
          title: newTitle,
          content: `# ${newTitle}`,
          // Parented under the open root page -- lets the "children" backend
          // check below target a known endpoint, and gives the proposed-
          // action card a page GUID (the parent's) to resolve into a title.
          parentGuid: pageTree.rootGuid,
        },
      }),
    ]);

    // Slow the actual create-page request down just enough to reliably
    // observe the transient "Applying..." status before it flips to
    // "Applied" -- the real local backend still services it (Pages.createPage
    // -> POST /api/pages), this only delays when the frontend sends it.
    await page.route('**/api/pages', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      await route.continue();
    });

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('Create a page for me');
    await page.keyboard.press('Enter');

    const preview = page.getByRole('region', { name: 'Proposed AI action' });
    await expect(preview).toBeVisible();

    // Exit-criterion: any page GUID in the proposed-action card resolves to
    // the real page title (PageTitleResolver), not the raw GUID. create_page
    // carries its parent's GUID, rendered as a link to that parent.
    await expect(preview.getByRole('link', { name: rootTitle })).toBeVisible();

    const applyBtn = preview.getByRole('button', { name: 'Apply', exact: true });
    await applyBtn.click();

    // The applying/applied status renders on the originating chat message
    // (chat-message.ts's action-status row, role="status"), not on the
    // preview card itself -- scope to the conversation log so this can't
    // collide with any other role="status" element on the page.
    const statusRow = page.getByRole('log', { name: 'Conversation' }).getByRole('status');
    await expect(statusRow).toHaveText(/Applying…/);
    await expect(statusRow).toHaveText(/Applied/);

    // The proposed-action card is dismissed once the action completes.
    await expect(preview).toBeHidden();

    // The tree does not auto-expand -- reveal Root's children to find the
    // newly created page.
    await page
      .getByRole('treeitem', { name: rootTitle })
      .getByRole('button', { name: 'Expand' })
      .click();
    await expect(page.getByRole('treeitem', { name: newTitle })).toBeVisible();

    // Verify against the real backend, not just UI state.
    const listRes = await request.get(`${API_BASE_URL}/pages/${pageTree.rootGuid}/children`, {
      headers: AUTH_HEADER,
    });
    expect(listRes.ok()).toBe(true);
    const { children } = (await listRes.json()) as { children: Array<{ title: string }> };
    expect(children.some((c) => c.title === newTitle)).toBe(true);
  });
});
