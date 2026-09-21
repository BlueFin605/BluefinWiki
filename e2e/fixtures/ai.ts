import type { Page } from '@playwright/test';

/**
 * Stubs Chrome's on-device Prompt API (`LanguageModel`), which isn't
 * available in Playwright's bundled Chromium (no Optimization Guide
 * component). Mirrors the exact `globalThis.LanguageModel = {...}` shape
 * every jsdom AI spec already uses (see `frontend/src/app/features/ai/ai.spec.ts`)
 * -- this is test-only infra, no production code changes.
 *
 * Reconciled against the real production contract:
 * - `LanguageModel.availability()` resolves to the string `'available'`
 *   (not a boolean) -- `frontend/src/app/features/ai/prompt-api.d.ts`'s
 *   `LanguageModelAvailability` union, and `ai.spec.ts`'s `installStub`.
 * - The session returned by `create()` needs `prompt`, `promptStreaming`,
 *   `destroy`, `inputUsage`, and `inputQuota` -- `ai.ts` reads
 *   `session.inputUsage`/`session.inputQuota` straight off the session
 *   after every prompt (see `ai.ts` around line 421-422), so a session
 *   stub missing those fields would push `undefined` into the app's
 *   signals. `promptStreaming` isn't called by production code today but
 *   is part of the `LanguageModelSession` contract every jsdom stub
 *   implements, so it's included as a no-op for shape parity.
 * - `session.prompt(text, options)` is called with two arguments --
 *   `text` plus a `{ responseConstraint, outputLanguage }` options object
 *   (`ai.ts` around line 440-446, `promptModel`). Only the first argument
 *   (the prompt text) is recorded for assertions, per this fixture's
 *   contract.
 * - Response shape mirrors the app's own contract (`ai.ts:435-459` /
 *   `promptModel` -> `parseResponse`): a JSON string with
 *   `{message: string, action?: {...}}`. This fixture queues raw
 *   JSON-string responses verbatim -- callers are responsible for
 *   providing valid JSON matching that shape.
 */
export async function installLanguageModelStub(page: Page, responses: string[]): Promise<void> {
  await page.addInitScript((queuedResponses) => {
    (window as unknown as { __promptCalls: string[] }).__promptCalls = [];
    let index = 0;
    (window as unknown as { LanguageModel: unknown }).LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        inputUsage: 0,
        inputQuota: 8000,
        prompt: async (text: string, _options?: unknown) => {
          (window as unknown as { __promptCalls: string[] }).__promptCalls.push(text);
          const response = queuedResponses[Math.min(index, queuedResponses.length - 1)];
          index++;
          return response;
        },
        promptStreaming: () => {
          throw new Error('promptStreaming is not implemented by the e2e LanguageModel stub');
        },
        destroy: () => {},
      }),
    };
  }, responses);
}

/** Every prompt's first-argument (text) content, in call order -- for asserting what reached the model. */
export async function getPromptCalls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __promptCalls: string[] }).__promptCalls ?? [],
  );
}
