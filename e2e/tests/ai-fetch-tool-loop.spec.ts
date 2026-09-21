import { test, expect } from '../fixtures/page-tree';
import { installLanguageModelStub } from '../fixtures/ai';

/**
 * Covers the Phase 7 AI sidebar exit criterion: a `fetch_url` action proposed
 * by the model runs automatically (no Apply click -- confirmed in
 * `frontend/src/app/features/ai/ai.ts`'s class doc and `ai-tools.ts`'s file
 * doc: "there is no Apply/Discard for fetch_url / fetch_imdb_show, unlike
 * the create/update/delete/move actions AiActionRunner dispatches"), renders
 * as a grey `tool`-role row (`chat-message.ts`'s `@case ('tool')` template,
 * `.msg.tool .tool-row`), and feeds the result back into the conversation as
 * the model's next turn. A second test covers the per-turn fetch cap
 * (`MAX_FETCHES_PER_TURN = 3`, `ai.ts:30`).
 *
 * Never hits the real `/api/fetch-url` proxy (SSRF-hardened against
 * loopback/private IPs in `backend/src/proxy/ip-guard.ts`, so it can't be
 * pointed at a local test server) -- every fetch attempt in both tests is
 * intercepted with `page.route()` and fulfilled with a canned response
 * shaped like the real `FetchUrlResult` contract (`ai-tools.ts`): `url`,
 * `text`, `contentType`, `truncated` are all required fields the app reads
 * off the response (`fetched.text.length` for the tool row's byte count,
 * `fetched.title || fetched.url` for its label) -- a body missing them would
 * throw inside `Ai.sendMessage` rather than exercise the loop.
 */
test.describe('AI fetch_url tool loop', () => {
  test('a fetch_url tool call runs automatically and the model continues with the result', async ({
    page,
    pageTree,
  }) => {
    await page.route('**/api/fetch-url', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://example.com/widgets',
          title: 'Widgets',
          text: 'Mocked fetched page content about widgets.',
          contentType: 'text/html',
          truncated: false,
        }),
      }),
    );

    await installLanguageModelStub(page, [
      JSON.stringify({
        message: 'Let me check that page.',
        action: { type: 'fetch_url', url: 'https://example.com/widgets' },
      }),
      JSON.stringify({ message: 'Based on the page, widgets cost $10.' }),
    ]);

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('What does example.com/widgets say?');
    await page.keyboard.press('Enter');

    // Grey tool row appears automatically -- no Apply click, no user action.
    await expect(page.locator('.msg.tool .tool-row')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Based on the page, widgets cost $10.')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('more than 3 fetch_url proposals in one turn are capped, not looped forever', async ({
    page,
    pageTree,
  }) => {
    await page.route('**/api/fetch-url', (route, request) => {
      const { url } = request.postDataJSON() as { url: string };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url,
          title: `Stub for ${url}`,
          text: 'stub',
          contentType: 'text/plain',
          truncated: false,
        }),
      });
    });

    // 4 distinct fetch proposals queued. Per ai.ts:255-421 (sendMessage's
    // fetch loop): fetchesRemaining starts at MAX_FETCHES_PER_TURN (3) and
    // is decremented once per *executed* fetch, checked at the TOP of the
    // while loop before the next fetch runs. Tracing the 4 queued proposals
    // against that loop:
    //   turn 1 (initial prompt) -> "checking 1"/fetch #1: remaining 3>0,
    //     fetch executes (tool row #1), remaining -> 2, re-prompt -> "checking 2"
    //   loop check: remaining 2>0 -> fetch #2 executes (tool row #2),
    //     remaining -> 1, re-prompt -> "checking 3"
    //   loop check: remaining 1>0 -> fetch #3 executes (tool row #3),
    //     remaining -> 0, re-prompt -> "checking 4"
    //   loop check: remaining 0>0 is FALSE -> loop exits WITHOUT executing a
    //     4th fetch. The "checking 4" proposal is never dispatched to
    //     AiTools.fetchUrl at all -- it only reaches the post-loop branch
    //     that appends the assistant's own message plus a system-role
    //     "Reached the fetch-per-turn limit..." notice (ai.ts:371-376).
    // That system notice renders via chat-message.ts's `@case ('system')`
    // branch (`.msg.system`), NOT `@case ('tool')` -- so it never becomes a
    // `.msg.tool .tool-row`. Net result: exactly 3 tool rows, and the 5th
    // queued response below is never consumed (the loop stops re-prompting
    // once it exits, and the stub repeats its last response if over-read).
    await installLanguageModelStub(page, [
      JSON.stringify({ message: 'checking 1', action: { type: 'fetch_url', url: 'https://example.com/1' } }),
      JSON.stringify({ message: 'checking 2', action: { type: 'fetch_url', url: 'https://example.com/2' } }),
      JSON.stringify({ message: 'checking 3', action: { type: 'fetch_url', url: 'https://example.com/3' } }),
      JSON.stringify({ message: 'checking 4', action: { type: 'fetch_url', url: 'https://example.com/4' } }),
      JSON.stringify({ message: 'Done, based on what I found.' }),
    ]);

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('Check several pages for me');
    await page.keyboard.press('Enter');

    const toolRows = page.locator('.msg.tool .tool-row');
    await expect(toolRows).toHaveCount(3, { timeout: 15_000 });

    // The cap is enforced, not just "happens to stop at 3" -- the system
    // notice from ai.ts:374-376 is the visible signal the loop hit the cap
    // rather than the model simply choosing to stop.
    await expect(page.getByText('Reached the fetch-per-turn limit')).toBeVisible();

    // Give any errant extra fetch a moment to show up before asserting the
    // count held steady -- guards against a race where a 4th row appears
    // after the toHaveCount(3) check above already passed transiently.
    await page.waitForTimeout(500);
    await expect(toolRows).toHaveCount(3);
  });
});
