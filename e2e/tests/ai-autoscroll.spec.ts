import { test, expect } from '../fixtures/page-tree';
import { installLanguageModelStub, sendAiMessage } from '../fixtures/ai';

/**
 * Covers the Phase 7 AI sidebar exit criterion for transcript auto-scroll.
 *
 * Real implementation: `frontend/src/app/features/ai/ai-sidebar.ts`'s
 * `constructor` (an `afterRenderEffect` around line 214). The transcript
 * container is `.messages[role="log"][aria-label="Conversation"]`
 * (`ai-sidebar.ts:77`). On every render where `ai.messages()` or
 * `ai.streaming()` changed, the effect's `earlyRead` phase computes
 * `distanceFromBottom = previousMessagesScrollHeight - scrollTop - clientHeight`
 * using the scrollHeight captured at the END of the PREVIOUS run (i.e. the
 * pre-append height) and the CURRENT scrollTop/clientHeight -- both
 * unaffected by appending content below the viewport, so they're safe to
 * read post-append. If that distance is under the 64px threshold
 * (`ai-sidebar.ts:227`), `mixedReadWrite` sets `container.scrollTop =
 * container.scrollHeight`, which the browser clamps to the actual max
 * scroll position (bottom). Otherwise scrollTop is left untouched -- the
 * guard never force-scrolls a user who scrolled up to read history.
 *
 * This is confirmed against `ai-sidebar.spec.ts`'s two existing jsdom cases
 * ("scrolls the transcript to the bottom when a new message is appended
 * near the bottom" / "does not force-scroll when user has scrolled up
 * beyond the threshold"), which exercise the exact same guard with stubbed
 * geometry. These two tests are the real-browser equivalent.
 */
test.describe('AI transcript auto-scroll', () => {
  test('the transcript scrolls to the newest message as it arrives', async ({ page, pageTree }) => {
    const longReply = 'A long reply. '.repeat(200); // force real overflow
    await installLanguageModelStub(page, [JSON.stringify({ message: longReply })]);

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await sendAiMessage(page, 'Give me a long answer');

    const log = page.getByRole('log', { name: 'Conversation' });
    await expect(page.getByText(longReply.slice(0, 20))).toBeVisible();

    // Precondition: the transcript must actually overflow its container, or
    // the scroll-position assertion below (`distance < 5`) would pass
    // vacuously at `0 - 0 = 0` even if the auto-scroll guard never fired.
    // 64 matches the near-bottom threshold constant (`ai-sidebar.ts:227`).
    expect(await log.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(64);

    // The browser clamps `scrollTop = scrollHeight` to the true max scroll
    // position, so once the guard fires this distance should land at (or
    // essentially at) 0 -- a small tolerance absorbs sub-pixel rounding.
    await expect
      .poll(async () => {
        return log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
      })
      .toBeLessThan(5);
  });

  test('scrolling up manually is not yanked back down by a new message', async ({ page, pageTree }) => {
    await installLanguageModelStub(page, [
      JSON.stringify({ message: 'first reply '.repeat(100) }),
      JSON.stringify({ message: 'second reply' }),
    ]);

    await page.goto(`/pages/${pageTree.rootGuid}`);
    await sendAiMessage(page, 'one');
    await expect(page.getByText('first reply')).toBeVisible();

    const log = page.getByRole('log', { name: 'Conversation' });
    // First reply overflows the container and the guard auto-scrolled to
    // the bottom already (this is the first-ever message, so the guard's
    // pre-append height starts at 0 -- always "near bottom"). Scroll back
    // up to simulate a user reading history.
    await log.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(100); // let the guard's own scroll-position read settle

    await page.getByRole('textbox', { name: 'Message' }).fill('two');
    await page.keyboard.press('Enter');
    await expect(page.getByText('second reply')).toBeVisible();

    // Precondition: without real overflow, `scrollTop = 0` above is a no-op
    // and this test's whole purpose -- proving the guard SUPPRESSED a
    // scroll -- would pass vacuously even if the guard never ran at all.
    expect(await log.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(64);

    const scrollTop = await log.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThan(50); // stayed near the top, wasn't yanked to bottom
  });
});
