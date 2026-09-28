import { test, expect } from '../fixtures/page-tree';
import { toggleInspector } from './helpers';

/**
 * The page comments feature (threaded, one level deep): post, reply, edit
 * your own comment, and delete — including the soft-delete-with-replies rule
 * (a comment with a reply renders as "[deleted]" but the reply survives).
 * Ownership enforcement (can't edit/delete someone else's comment) is
 * covered at the unit level (`comments-service.test.ts`,
 * `comments-panel.spec.ts`) — this suite runs as a single authenticated
 * user, so a real cross-user check isn't exercisable here.
 */
test.describe('Page comments', () => {
  test('post, reply, edit, and delete (with soft-delete-with-replies)', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await toggleInspector(page);
    await page.getByRole('tab', { name: /comments/i }).click();

    await expect(page.getByText(/no comments yet/i)).toBeVisible();

    // Post a top-level comment.
    await page.getByPlaceholder('Write a comment…').fill('Original comment text');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByText('Original comment text')).toBeVisible();

    // Reply to it.
    await page.getByRole('button', { name: 'Reply', exact: true }).click();
    await page.getByPlaceholder('Write a reply…').fill('A reply');
    await page.getByRole('button', { name: 'Reply', exact: true }).last().click();
    await expect(page.getByText('A reply')).toBeVisible();

    // Edit the top-level comment (your own).
    await page.getByRole('button', { name: 'Edit comment' }).click();
    await page.locator('textarea.edit-box').fill('Edited comment text');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Edited comment text')).toBeVisible();
    await expect(page.getByText('(edited)')).toBeVisible();

    // Delete the top-level comment while it still has a reply: soft-delete,
    // not a hard removal — the reply must survive.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete comment' }).click();
    await expect(page.getByText('[deleted]')).toBeVisible();
    await expect(page.getByText('Edited comment text')).not.toBeVisible();
    await expect(page.getByText('A reply')).toBeVisible();

    // Delete the now-leaf reply: removed outright.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete reply' }).click();
    await expect(page.getByText('A reply')).not.toBeVisible();

    // The soft-deleted top-level comment's placeholder remains.
    await expect(page.getByText('[deleted]')).toBeVisible();
  });

  test('comment count badge on the Comments tab tracks the thread', async ({ page, pageTree }) => {
    await page.goto(`/pages/${pageTree.childGuid}`);
    await toggleInspector(page);
    const tab = page.getByRole('tab', { name: /comments/i });

    // Zero state: no badge.
    await expect(tab).toHaveAccessibleName('Comments');

    await tab.click();
    await page.getByPlaceholder('Write a comment…').fill('First comment');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByText('First comment')).toBeVisible();

    await expect(tab).toHaveAccessibleName('Comments, 1 comments');
  });
});
