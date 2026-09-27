/**
 * AiActionRunner — thin dispatcher for `ActionPreview`'s Apply button (step
 * 7.1). Maps `AiAction.type` to the matching `Pages` mutation:
 *
 *   create_page -> Pages.createPage
 *   update_page -> Pages.updatePage
 *   delete_page -> Pages.deletePage  (gated: environment.aiAllowDestructive)
 *   move_page   -> Pages.movePage    (gated: environment.aiAllowDestructive)
 *
 * Precise invalidation is NOT duplicated here — every `Pages` mutation
 * already bumps the correct per-resource tag(s) via the `InvalidationBus`
 * (step 1.2's convention, see `core/api/invalidation.ts`), so simply calling
 * through `Pages` gets `create_page` -> `children:<parent>`, `update_page`
 * -> `page:<guid>`, etc. "for free" — no parallel invalidation mechanism is
 * introduced.
 *
 * `fetch_url` / `fetch_imdb_show` have no mapped mutation here — `Ai.sendMessage`
 * (step 7.2's auto fetch-tool loop) intercepts and auto-executes those two
 * action types before a `currentAction` is ever set, so `ActionPreview`/this
 * runner never sees them in practice. The `default` case below still resolves
 * them (and any future unmapped type) to a failure result rather than
 * throwing, purely as a defensive fallback.
 */

import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Pages } from '../pages/pages';
import type { CreatePageRequest, PageProperty, UpdatePageRequest } from '../pages/page.types';
import type { AiAction } from './ai';

export interface ActionRunResult {
  ok: boolean;
  /** Present when `ok` is false — the message to show on the card and in the log. */
  error?: string;
}

const DESTRUCTIVE_DISABLED_MESSAGE =
  'Destructive actions are disabled in this deployment.';

@Injectable({ providedIn: 'root' })
export class AiActionRunner {
  private readonly pages = inject(Pages);

  async run(action: AiAction): Promise<ActionRunResult> {
    try {
      switch (action.type) {
        case 'create_page': {
          const body: CreatePageRequest = {
            title: action.title ?? '',
            parentGuid: action.parentGuid ?? null,
            content: action.content,
            pageType: action.pageType,
            properties: action.pageProperties as
              | Record<string, PageProperty>
              | undefined,
          };
          // Conditionally included (unlike the fields above): Pages.createPage
          // bumps the shared tag vocabulary based on `'tags' in body`, so an
          // explicit `tags: undefined` key would wrongly trigger that bump.
          if (action.tags !== undefined) body.tags = action.tags;
          await this.pages.createPage(body);
          return { ok: true };
        }

        case 'update_page': {
          if (!action.pageGuid) {
            return { ok: false, error: 'The proposed action is missing a page GUID.' };
          }
          const body: UpdatePageRequest = {};
          if (action.title !== undefined) body.title = action.title;
          if (action.content !== undefined) body.content = action.content;
          if (action.tags !== undefined) body.tags = action.tags;
          if (action.pageType !== undefined) body.pageType = action.pageType;
          if (action.pageProperties !== undefined) {
            body.properties = action.pageProperties as Record<string, PageProperty>;
          }
          await this.pages.updatePage(action.pageGuid, body);
          return { ok: true };
        }

        case 'delete_page': {
          if (!environment.aiAllowDestructive) {
            return { ok: false, error: DESTRUCTIVE_DISABLED_MESSAGE };
          }
          if (!action.pageGuid) {
            return { ok: false, error: 'The proposed action is missing a page GUID.' };
          }
          await this.pages.deletePage(action.pageGuid, { recursive: action.recursive });
          return { ok: true };
        }

        case 'move_page': {
          if (!environment.aiAllowDestructive) {
            return { ok: false, error: DESTRUCTIVE_DISABLED_MESSAGE };
          }
          if (!action.pageGuid) {
            return { ok: false, error: 'The proposed action is missing a page GUID.' };
          }
          await this.pages.movePage(action.pageGuid, {
            newParentGuid: action.newParentGuid ?? null,
          });
          return { ok: true };
        }

        default:
          // 'none' never reaches here (Ai.sendMessage only sets currentAction
          // for a non-none type); fetch_url/fetch_imdb_show are auto-executed
          // by Ai.sendMessage's fetch-tool loop (step 7.2) and never surface
          // as a currentAction, so this is a defensive fallback only.
          return {
            ok: false,
            error: `This action type ("${action.type}") can't be applied yet.`,
          };
      }
    } catch (err) {
      return { ok: false, error: extractServerMessage(err) };
    }
  }
}

/** Server message from a failed request: `err.error?.message ?? err.message`. */
function extractServerMessage(err: unknown): string {
  const e = err as { error?: { message?: unknown } | null; message?: unknown } | null;
  if (typeof e?.error?.message === 'string' && e.error.message) return e.error.message;
  if (typeof e?.message === 'string' && e.message) return e.message;
  return 'The action failed. Try again.';
}
