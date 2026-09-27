import { test, expect, deletePageRecursive } from '../fixtures/page-tree';
import { installLanguageModelStub, getPromptCalls } from '../fixtures/ai';
import { API_BASE_URL, AUTH_HEADER } from '../fixtures/api';
import { openAiOverlay } from './helpers';

const AI_INSTRUCTIONS_ROOT_TITLE = 'AI Instructions';

/**
 * Mirrors `AiInstructions.ensureRootGuid()`
 * (`frontend/src/app/features/ai/ai-instructions.ts`) via the real API.
 *
 * That method is only reached from the "Create" flow
 * (`createInstruction` -> `ensureRootGuid`) -- `listInstructions` (what the
 * picker calls when it opens) goes through `findRootGuid` alone, which is
 * read-only and never creates the root. So a fresh dev stack has no "AI
 * Instructions" root page until someone actually creates an instruction
 * through the app, and merely opening the picker will NOT produce it.
 * Verified directly against this task's running dev backend: a fresh
 * `GET /pages/root/children` listed no page titled "AI Instructions".
 * This helper creates it the same way `ensureRootGuid()` does (a plain page
 * at the wiki root) so the first test below can seed a real instruction
 * under it without depending on prior app state.
 */
async function ensureAiInstructionsRoot(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const rootRes = await request.get(`${API_BASE_URL}/pages/root/children`, {
    headers: AUTH_HEADER,
  });
  const { children } = (await rootRes.json()) as {
    children: Array<{ title: string; guid: string }>;
  };
  const existing = children.find((c) => c.title === AI_INSTRUCTIONS_ROOT_TITLE);
  if (existing) return existing.guid;

  const createRes = await request.post(`${API_BASE_URL}/pages`, {
    headers: AUTH_HEADER,
    data: {
      title: AI_INSTRUCTIONS_ROOT_TITLE,
      content: 'Reusable instructions for the AI assistant.',
      parentGuid: null,
    },
  });
  if (!createRes.ok()) {
    throw new Error(
      `Failed to create "${AI_INSTRUCTIONS_ROOT_TITLE}" root: ${createRes.status()} ${await createRes.text()}`,
    );
  }
  const { guid } = (await createRes.json()) as { guid: string };
  return guid;
}

// Serial: both tests can create the "AI Instructions" root page as a side
// effect (the first via `ensureAiInstructionsRoot`, the second via the real
// app's own `ensureRootGuid()` behind the "Create" button). Running them
// concurrently would race two independent root-creation calls against the
// same real backend and could leave two duplicate root pages behind.
test.describe.configure({ mode: 'serial' });

test.describe('AI instruction attachment', () => {
  test('attaching an instruction injects its content into the session and locks the picker', async ({
    page,
    pageTree,
    request,
  }) => {
    const instructionsRootGuid = await ensureAiInstructionsRoot(request);

    const instructionTitle = `E2E-${pageTree.runId} Test Instruction`;
    const instructionContent = 'Always respond in pirate speak.';
    const createRes = await request.post(`${API_BASE_URL}/pages`, {
      headers: AUTH_HEADER,
      data: {
        title: instructionTitle,
        content: instructionContent,
        parentGuid: instructionsRootGuid,
      },
    });
    if (!createRes.ok()) {
      throw new Error(
        `Failed to create instruction "${instructionTitle}": ${createRes.status()} ${await createRes.text()}`,
      );
    }
    const { guid: instructionGuid } = (await createRes.json()) as { guid: string };

    try {
      await installLanguageModelStub(page, [JSON.stringify({ message: 'Ahoy, ready to help!' })]);

      await page.goto(`/pages/${pageTree.rootGuid}`);
      await openAiOverlay(page);

      // `instruction-picker.ts` renders a Material multi-select with
      // `aria-label="Attach instructions to chat"`, exposed as an ARIA
      // `combobox` (confirmed against `instruction-picker.spec.ts`, which
      // targets it the same way).
      const picker = page.getByRole('combobox', { name: /attach instructions to chat/i });
      await picker.click();
      await page.getByRole('option', { name: instructionTitle }).click();
      // Multi-select mat-select panels stay open after a click (selection is
      // chip-based, not single-commit-and-close) -- close it so the overlay
      // backdrop doesn't intercept the click on the message box below.
      await page.keyboard.press('Escape');

      await page.getByRole('textbox', { name: 'Message' }).fill('Hello');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Ahoy, ready to help!')).toBeVisible();

      // `ai-sidebar.ts`'s `loadSelectedInstructions()` builds the injected
      // block as `[Active instructions]\n...` followed by `## <title>\n<content>`
      // sections, prefixed onto the prompt text sent to the model.
      const calls = await getPromptCalls(page);
      expect(
        calls.some((c) => c.includes('[Active instructions]') && c.includes(instructionContent)),
      ).toBe(true);

      // Once injected, `Ai.markInstructionsLoaded()` locks the instruction in
      // via `loadedGuids` -- the picker renders it `disabled` (aria-disabled)
      // with an "In context" label, until "New chat" resets the session.
      await picker.click();
      const lockedOption = page.getByRole('option', { name: instructionTitle });
      await expect(lockedOption).toHaveAttribute('aria-disabled', 'true');
      await expect(lockedOption.getByText(/in context/i)).toBeVisible();
      // Multi-select panel stays open after the click above -- close it so
      // its CDK overlay backdrop doesn't intercept the "New chat" click.
      await page.keyboard.press('Escape');

      // Exit criterion (second half): the lock holds only "until New chat".
      // `onNewChat()` (`ai-sidebar.ts:266`) calls `Ai.reset()`, which clears
      // `_loadedInstructionIds` (`ai.ts:577`) -- reopening the picker after
      // that should show the instruction unlocked again.
      await page.getByRole('button', { name: 'New chat' }).click();
      await picker.click();
      const unlockedOption = page.getByRole('option', { name: instructionTitle });
      await expect(unlockedOption).not.toHaveAttribute('aria-disabled', 'true');
      await expect(unlockedOption.getByText(/in context/i)).toBeHidden();
    } finally {
      await deletePageRecursive(request, instructionGuid);
    }
  });

  test('"Create" makes a new instruction page and opens it in the editor', async ({
    page,
    pageTree,
    request,
  }) => {
    const instructionsRootGuid = await ensureAiInstructionsRoot(request);

    await installLanguageModelStub(page, [JSON.stringify({ message: 'ok' })]);
    await page.goto(`/pages/${pageTree.rootGuid}`);
    await openAiOverlay(page);

    // The create-instruction input/button are rendered as a sibling of the
    // mat-select, not inside its dropdown panel -- no need to open the
    // picker first (and doing so would leave its CDK overlay panel covering
    // this row, intercepting the click below).
    const newTitle = `E2E-${pageTree.runId} Created Instruction`;
    let newGuid: string | undefined;

    try {
      // `instruction-picker.ts`'s create input has
      // placeholder="New instruction title…" (aria-label "New instruction title").
      await page.getByPlaceholder(/new instruction title/i).fill(newTitle);
      // Button text toggles "Create" / "Creating…" -- anchor to avoid matching
      // the in-flight label.
      await page.getByRole('button', { name: /^create$/i }).click();

      await page.waitForURL(/\/pages\/.+\/edit/);

      const match = page.url().match(/\/pages\/([^/]+)\/edit/);
      newGuid = match?.[1];
      expect(newGuid).toBeTruthy();

      await expect(page.locator('wiki-markdown-toolbar')).toBeVisible();

      // Exit criterion (second half): "Create" makes a child page under "AI
      // Instructions" -- not just any page. `createInstruction` ->
      // `ensureRootGuid()` (`ai-instructions.ts`) parents the new page under
      // the same root `ensureAiInstructionsRoot` resolves above. Verify
      // against the real backend, not just that a page/editor appeared.
      const childrenRes = await request.get(
        `${API_BASE_URL}/pages/${instructionsRootGuid}/children`,
        { headers: AUTH_HEADER },
      );
      expect(childrenRes.ok()).toBe(true);
      const { children } = (await childrenRes.json()) as { children: Array<{ guid: string }> };
      expect(children.some((c) => c.guid === newGuid)).toBe(true);
    } finally {
      if (newGuid) {
        await deletePageRecursive(request, newGuid);
      }
    }
  });
});
