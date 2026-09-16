/**
 * Ai — wraps Chrome's on-device Prompt API (Gemini Nano) for the wiki, with
 * signal-backed state for messages / context-window usage / current action.
 *
 * Ports `frontend/src/services/AiService.ts` (273 lines) — schema, system
 * prompt, JSON parsing, ALLOW_DESTRUCTIVE gating — and folds the React
 * `useAi` orchestration of message log + action lifecycle into a single
 * Angular service. RAG context loading lives in the sidebar component; action
 * execution is dispatched by `AiActionRunner` (step 7.1) and its lifecycle is
 * tracked here (`beginApplyingAction` / `completeAction` / `markActionFailed`
 * / `rejectAction`).
 *
 * `sendMessage` also owns the auto fetch-tool loop (step 7.2, porting React's
 * `useAi.send`): when a response's `action.type` is `fetch_url` or
 * `fetch_imdb_show`, the matching `AiTools` call is dispatched automatically
 * (no Apply button — unlike create/update/delete/move), its result is
 * rendered as a `tool`-role row and fed back to the model as the next turn,
 * and the loop continues until the model stops proposing a fetch. A per-turn
 * counter (`MAX_FETCHES_PER_TURN`) and a `Set` of already-fetched keys guard
 * against runaway loops — both are local to one `sendMessage` call, so they
 * reset on every new user message.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { aiDebug, aiElapsedMs, aiNow } from './ai-debug';
import { AiTools, type FetchUrlResult, type ImdbShowDetailsResult } from './ai-tools';

/** Hard cap on auto-executed `fetch_url` / `fetch_imdb_show` actions per user turn. */
const MAX_FETCHES_PER_TURN = 3;

const ALLOW_DESTRUCTIVE = environment.aiAllowDestructive;

const ACTION_TYPES_BASE = [
  'none',
  'create_page',
  'update_page',
  'fetch_url',
  'fetch_imdb_show',
] as const;
const DESTRUCTIVE_TYPES = ['delete_page', 'move_page'] as const;
const ACTION_TYPES = ALLOW_DESTRUCTIVE
  ? [...ACTION_TYPES_BASE, ...DESTRUCTIVE_TYPES]
  : ACTION_TYPES_BASE;

const SYSTEM_PROMPT = buildSystemPrompt(ALLOW_DESTRUCTIVE);
const RESPONSE_SCHEMA = buildResponseSchema(ACTION_TYPES);

export const aiAllowsDestructive = ALLOW_DESTRUCTIVE;

function buildSystemPrompt(allowDestructive: boolean): string {
  const destructiveLines = allowDestructive
    ? `- "delete_page" — propose deletion. Provide pageGuid, and recursive=true if it has children. DESTRUCTIVE — only when the user clearly asks
- "move_page" — propose reparenting. Provide pageGuid and newParentGuid (or null for root). DESTRUCTIVE — only when the user clearly asks`
    : '(delete and move actions are disabled in this deployment)';

  return `You are the BlueFinWiki assistant. You help the user navigate, edit, and create wiki pages.

The wiki stores pages with: title (string), content (markdown), tags (string[]), parent page (for hierarchy), and a GUID identifier. You will be given the current page the user is viewing and a list of semantically related pages in each turn.

You respond with one JSON object: { "message": "...", "action": { ... } }.

"message" is a short, helpful reply to the user (1-3 sentences). Keep it terse.

"action.type" must be one of:
- "none" — chat-only reply, no wiki change
- "create_page" — propose a new page. Provide title, content (markdown), optional parentGuid, optional tags, optional pageType (GUID), optional pageProperties
- "update_page" — propose changes to an existing page. Provide pageGuid plus any of: title, content, tags, pageType (GUID), pageProperties
- "fetch_url" — fetch a public web page and continue the conversation with its content. Use when the user gives you a URL, asks about an external article, or you genuinely need external information you don't have. Provide the "url" field. The system will fetch it and feed the extracted text back as your next user turn; you can then propose create_page/update_page with that material.
- "fetch_imdb_show" — fetch IMDb TV show details. Use when the user asks about a TV show's synopsis, season count, or IMDb rating. Provide "showQuery" (title text) and optionally "imdbId" if the user provided one.
${destructiveLines}

Rules:
- Never invent a pageGuid. Only use GUIDs given to you in the context.
- Do not propose create_page, update_page, delete_page, or move_page unless the user explicitly asks for a wiki change (create/save/update/edit/delete/move). If the user is only asking for information, use fetch_imdb_show/fetch_url or action.type = "none".
- For create_page, parentGuid is optional — omit for a root page, or use the current page's GUID for a child.
- For typed pages, set pageType to a GUID from the "Available page types" list in context. Set pageProperties as { "prop-name": { "type": "string"|"number"|"date"|"tags", "value": <value> } } where tags type value is an array of strings. Only use pageType when the user explicitly wants a typed page.
- For fetch_url, only request URLs the user has clearly referred to or that follow logically from the conversation. Do not invent URLs. The proxy will reject non-public URLs.
- For fetch_imdb_show, only use it for TV shows. Pass the best available title in showQuery and avoid inventing unknown IDs. When a user asks about a show's synopsis, seasons, or rating, prefer fetch_imdb_show first before using wiki search context.
- After a successful fetch_url or fetch_imdb_show tool result, answer the user directly. Do not ask for permission to continue if the user already asked for the information.
- Only ask a clarifying question before fetching when the target show/page is ambiguous (for example: multiple possible titles and no clear intent).
- Don't loop fetch_url indefinitely; the system caps it at 3 fetches per user turn. After fetching, propose a concrete action or summarise.
- If you don't have enough info to act, ask a clarifying question with action.type = "none".
- Default to "none" when in doubt — the user reviews every proposed change.`;
}

function buildResponseSchema(actionTypes: readonly string[]) {
  return {
    type: 'object',
    properties: {
      message: { type: 'string' },
      action: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...actionTypes] },
          title: { type: 'string' },
          content: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          pageGuid: { type: 'string' },
          parentGuid: { type: ['string', 'null'] },
          newParentGuid: { type: ['string', 'null'] },
          recursive: { type: 'boolean' },
          url: { type: 'string' },
          showQuery: { type: 'string' },
          imdbId: { type: 'string' },
          pageType: { type: 'string' },
          pageProperties: { type: 'object' },
        },
        required: ['type'],
        additionalProperties: false,
      },
    },
    required: ['message', 'action'],
    additionalProperties: false,
  };
}

export type AiActionType =
  | 'none'
  | 'create_page'
  | 'update_page'
  | 'delete_page'
  | 'move_page'
  | 'fetch_url'
  | 'fetch_imdb_show';

export interface AiAction {
  type: AiActionType;
  title?: string;
  content?: string;
  tags?: string[];
  pageGuid?: string;
  pageType?: string;
  pageProperties?: Record<
    string,
    { type: string; value: string | number | string[] }
  >;
  parentGuid?: string | null;
  newParentGuid?: string | null;
  recursive?: boolean;
  url?: string;
  showQuery?: string;
  imdbId?: string;
}

export interface AiResponse {
  message: string;
  action: AiAction;
}

export type ActionStatus =
  | 'pending'
  | 'applying'
  | 'applied'
  | 'discarded'
  | 'failed';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

/** Metadata shown on a `tool`-role message's grey info row. */
export interface ToolMeta {
  url: string;
  bytes: number;
  truncated: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  action?: AiAction;
  actionStatus?: ActionStatus;
  actionError?: string;
  toolMeta?: ToolMeta;
}

export type AiAvailability = LanguageModelAvailability | 'unsupported';

const PROMPT_OUTPUT_LANGUAGE = 'en' as const;

@Injectable({ providedIn: 'root' })
export class Ai {
  private readonly _messages = signal<readonly ChatMessage[]>([]);
  private readonly _inputUsage = signal<number>(0);
  private readonly _inputQuota = signal<number>(0);
  private readonly _streaming = signal<boolean>(false);
  private readonly _currentAction = signal<AiAction | null>(null);
  private readonly _currentActionMessageId = signal<string | null>(null);
  /** GUIDs of instructions already injected into the current session (step 7.3). */
  private readonly _loadedInstructionIds = signal<readonly string[]>([]);

  readonly messages = computed(() => this._messages());
  readonly inputUsage = computed(() => this._inputUsage());
  readonly inputQuota = computed(() => this._inputQuota());
  readonly streaming = computed(() => this._streaming());
  readonly currentAction = computed(() => this._currentAction());
  readonly loadedInstructionIds = computed(() => this._loadedInstructionIds());

  private readonly tools = inject(AiTools);

  private session: LanguageModelSession | null = null;
  private creating: Promise<LanguageModelSession> | null = null;

  async isAvailable(): Promise<AiAvailability> {
    if (typeof LanguageModel === 'undefined') return 'unsupported';
    try {
      return await LanguageModel.availability();
    } catch (err) {
      console.warn('LanguageModel.availability() failed:', err);
      return 'unsupported';
    }
  }

  /**
   * Send a user message. Updates `messages`, `inputUsage`/`inputQuota`, and
   * `currentAction` (when the model proposes an actionable change).
   * `ragContext` and `instructionContext` are optional and prefixed onto the
   * user turn — never as a second system message (Chrome's Prompt API
   * rejects that). When both are given, `instructionContext` comes first
   * (matching React's `[instructionsBlock, ragContext]` ordering) — selected
   * instructions are the user's standing preferences for the whole chat, RAG
   * context is per-turn. Callers (the sidebar) are responsible for tracking
   * which instructions they've already injected and only passing the text
   * for newly-selected ones; this method does not dedupe on its own.
   *
   * When the model's response proposes `fetch_url` or `fetch_imdb_show`,
   * this method auto-executes it (see the auto fetch-tool loop doc on the
   * class) instead of surfacing it as a pending action — the loop keeps
   * going, capped at `MAX_FETCHES_PER_TURN` and with duplicate-fetch
   * detection, until the model settles on a non-fetch response.
   */
  async sendMessage(
    userMessage: string,
    ragContext?: string,
    instructionContext?: string,
  ): Promise<AiResponse> {
    const startedAt = aiNow();
    aiDebug('service:send-start', {
      messageChars: userMessage.length,
      contextChars: ragContext?.length ?? 0,
      instructionContextChars: instructionContext?.length ?? 0,
    });

    const trimmed = userMessage.trim();
    if (!trimmed) {
      throw new Error('sendMessage called with empty message');
    }

    this._messages.update((list) => [
      ...list,
      { id: makeId(), role: 'user', text: trimmed },
    ]);
    this._streaming.set(true);

    // Per-turn fetch-loop guards. Local to this call, so they reset on every
    // new user message rather than persisting across the whole session.
    const fetchedKeys = new Set<string>();
    let fetchesRemaining = MAX_FETCHES_PER_TURN;

    try {
      const session = await this.ensureSession();
      const contextParts = [instructionContext, ragContext].filter(
        (part): part is string => !!part && part.length > 0,
      );
      const combined =
        contextParts.length > 0
          ? `[Context]\n${contextParts.join('\n\n')}\n\n[Message]\n${trimmed}`
          : trimmed;

      let response = await this.promptModel(session, combined);

      while (isAutoFetchAction(response.action) && fetchesRemaining > 0) {
        const action = response.action;
        const fetchKey = makeFetchKey(action);

        if (fetchedKeys.has(fetchKey)) {
          aiDebug('service:auto-fetch-duplicate', { fetchKey, actionType: action.type });
          this.appendSystemMessage(
            'AI repeated the same fetch request. I will answer from the data already retrieved.',
          );
          // A duplicate proposal still consumes the per-turn budget — the
          // model re-proposing the same key must not let the loop run
          // unbounded (Finding 2). Genuine, distinct fetches are unaffected:
          // this only fires once a key has already been recorded below.
          fetchesRemaining -= 1;
          response = await this.promptModel(session, buildNoRefetchNudge(action.type));
          continue;
        }
        fetchedKeys.add(fetchKey);

        if (action.type === 'fetch_url') {
          const url = (action.url ?? '').trim();
          if (!url) {
            this.appendAssistantMessage(response.message);
            this.appendSystemMessage('AI requested fetch_url but provided no URL.');
            break;
          }

          this.appendAssistantMessage(response.message || `Fetching ${url}...`);

          let fetched: FetchUrlResult;
          try {
            fetched = await this.tools.fetchUrl(url);
          } catch (err) {
            this.appendSystemMessage(`Fetch failed: ${errorMessage(err)}`);
            break;
          }

          this.appendToolMessage(fetched.title || fetched.url, {
            url: fetched.url,
            bytes: fetched.text.length,
            truncated: fetched.truncated,
          });
          fetchesRemaining -= 1;

          response = await this.promptModel(
            session,
            formatFetchAsUserTurn(fetched, fetchesRemaining),
          );
          continue;
        }

        const showQuery = (action.showQuery ?? '').trim();
        const imdbId = (action.imdbId ?? '').trim();
        if (!showQuery && !imdbId) {
          this.appendAssistantMessage(response.message);
          this.appendSystemMessage(
            'AI requested fetch_imdb_show but provided no showQuery or imdbId.',
          );
          break;
        }

        this.appendAssistantMessage(
          response.message || `Fetching IMDb details for ${showQuery || imdbId}...`,
        );

        let fetchedImdb: ImdbShowDetailsResult;
        try {
          fetchedImdb = await this.tools.fetchImdbShow({
            query: showQuery || undefined,
            imdbId: imdbId || undefined,
          });
        } catch (err) {
          this.appendSystemMessage(`IMDb lookup failed: ${errorMessage(err)}`);
          break;
        }

        this.appendToolMessage(fetchedImdb.title || fetchedImdb.url, {
          url: fetchedImdb.url,
          bytes: fetchedImdb.synopsis.length,
          truncated: false,
        });
        fetchesRemaining -= 1;

        response = await this.promptModel(
          session,
          formatImdbAsUserTurn(fetchedImdb, fetchesRemaining),
        );
      }

      // Single finalization step for every loop exit path (success on a
      // non-fetch action, cap-reached, or an error/missing-input break
      // above): each one must leave `_currentAction` /
      // `_currentActionMessageId` in a deliberate state, never a value left
      // over from a prior turn (Finding 1). Only the non-fetch branch can
      // ever produce an actionable proposal; the other two branches fall
      // through to the `null` default below.
      let finalAction: AiAction | null = null;
      let finalActionMessageId: string | null = null;

      if (isAutoFetchAction(response.action) && fetchesRemaining === 0) {
        aiDebug('service:auto-fetch-limit-reached', { actionType: response.action.type });
        this.appendAssistantMessage(response.message);
        this.appendSystemMessage(
          'Reached the fetch-per-turn limit. Ask me again if you need more lookups.',
        );
      } else if (!isAutoFetchAction(response.action)) {
        const assistantId = makeId();
        const action =
          response.action.type !== 'none' ? response.action : undefined;
        this._messages.update((list) => [
          ...list,
          {
            id: assistantId,
            role: 'assistant',
            text: response.message,
            action,
            actionStatus: action ? 'pending' : undefined,
          },
        ]);

        if (action) {
          finalAction = action;
          finalActionMessageId = assistantId;
        }
      }
      // The remaining case — broke out of the loop above on a fetch error or
      // missing input, with fetches still remaining — has already reported
      // itself via the system message appended at the break site, matching
      // React: the turn simply ends without a further assistant bubble.
      // Either way, `finalAction`/`finalActionMessageId` are still `null`
      // here, which is the correct terminal state.

      this._currentAction.set(finalAction);
      this._currentActionMessageId.set(finalActionMessageId);

      this._inputUsage.set(session.inputUsage);
      this._inputQuota.set(session.inputQuota);

      aiDebug('service:send-complete', {
        elapsedMs: aiElapsedMs(startedAt),
        actionType: response.action.type,
      });
      return response;
    } finally {
      this._streaming.set(false);
    }
  }

  /** Low-level model round trip: prompt + parse, with no message-log side effects. */
  private async promptModel(
    session: LanguageModelSession,
    text: string,
  ): Promise<AiResponse> {
    const promptStart = aiNow();
    const promptOptions: LanguageModelPromptOptions & { outputLanguage: 'en' } = {
      responseConstraint: RESPONSE_SCHEMA,
      outputLanguage: PROMPT_OUTPUT_LANGUAGE,
    };
    let raw: string;
    try {
      raw = await session.prompt(text, promptOptions);
      aiDebug('service:prompt-success', {
        elapsedMs: aiElapsedMs(promptStart),
        rawChars: raw.length,
      });
    } catch (err) {
      aiDebug('service:prompt-failed', {
        elapsedMs: aiElapsedMs(promptStart),
        error: errorMessage(err),
      });
      throw new Error(`Prompt API call failed: ${errorMessage(err)}`, { cause: err });
    }
    return parseResponse(raw);
  }

  private appendAssistantMessage(text: string): void {
    this._messages.update((list) => [
      ...list,
      { id: makeId(), role: 'assistant', text },
    ]);
  }

  private appendToolMessage(text: string, toolMeta: ToolMeta): void {
    this._messages.update((list) => [
      ...list,
      { id: makeId(), role: 'tool', text, toolMeta },
    ]);
  }

  /**
   * Begin applying the current action: flips the owning message's status to
   * `applying` and returns the action for the caller (the action runner) to
   * dispatch. Returns `null` when there is nothing pending. Deliberately does
   * NOT clear `currentAction` — the card stays mounted while the mutation is
   * in flight, and on failure the action stays current so the user can retry
   * (Apply again) or discard.
   */
  beginApplyingAction(): AiAction | null {
    const action = this._currentAction();
    const messageId = this._currentActionMessageId();
    if (!action || !messageId) return null;
    this.updateMessage(messageId, {
      actionStatus: 'applying',
      actionError: undefined,
    });
    return action;
  }

  /** Mark the current action as successfully applied and clear it. */
  completeAction(): void {
    const messageId = this._currentActionMessageId();
    if (messageId) {
      this.updateMessage(messageId, { actionStatus: 'applied' });
    }
    this._currentAction.set(null);
    this._currentActionMessageId.set(null);
  }

  /**
   * Mark the current action as failed with the given error message. The
   * action is deliberately left current (not cleared) so the user can retry
   * (Apply again) or discard it.
   */
  markActionFailed(error: string): void {
    const messageId = this._currentActionMessageId();
    if (!messageId) return;
    this.updateMessage(messageId, {
      actionStatus: 'failed',
      actionError: error,
    });
  }

  /** Discard the proposed action without executing it. */
  rejectAction(): void {
    const messageId = this._currentActionMessageId();
    if (messageId) {
      this.updateMessage(messageId, { actionStatus: 'discarded' });
    }
    this._currentAction.set(null);
    this._currentActionMessageId.set(null);
  }

  /**
   * Record instruction GUIDs as injected into the current session (step
   * 7.3). Once here, an instruction is locked in the picker — deselecting it
   * cannot undo the injection — until `reset()` ("New chat") clears this.
   * Additive and idempotent: existing entries are kept, duplicates skipped.
   */
  markInstructionsLoaded(ids: readonly string[]): void {
    this._loadedInstructionIds.update((existing) => {
      const additions = ids.filter((id) => !existing.includes(id));
      return additions.length > 0 ? [...existing, ...additions] : existing;
    });
  }

  reset(): Promise<void> {
    aiDebug('chat:reset');
    if (this.session) {
      try {
        this.session.destroy();
      } catch (err) {
        console.warn('Failed to destroy session:', err);
      }
      this.session = null;
    }
    this._messages.set([]);
    this._inputUsage.set(0);
    this._inputQuota.set(0);
    this._currentAction.set(null);
    this._currentActionMessageId.set(null);
    // Loaded (injected) instructions are cleared — the picker's own
    // *selection* is untouched here; it lives outside `Ai` and survives
    // "New chat" by design (React parity).
    this._loadedInstructionIds.set([]);
    return Promise.resolve();
  }

  /** Test-only: append a system message (used by the sidebar for tool errors). */
  appendSystemMessage(text: string): void {
    this._messages.update((list) => [
      ...list,
      { id: makeId(), role: 'system', text },
    ]);
  }

  private updateMessage(id: string, patch: Partial<ChatMessage>): void {
    this._messages.update((list) =>
      list.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  private async ensureSession(): Promise<LanguageModelSession> {
    if (this.session) {
      aiDebug('service:session-reuse');
      return this.session;
    }
    if (this.creating) {
      aiDebug('service:session-await-existing-create');
      return this.creating;
    }
    if (typeof LanguageModel === 'undefined') {
      throw new Error('LanguageModel is not available in this browser');
    }
    const createStart = aiNow();
    aiDebug('service:session-create-start');
    this.creating = LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      outputLanguage: PROMPT_OUTPUT_LANGUAGE,
    })
      .then((s: LanguageModelSession) => {
        this.session = s;
        this.creating = null;
        aiDebug('service:session-create-success', {
          elapsedMs: aiElapsedMs(createStart),
        });
        return s;
      })
      .catch((err: unknown) => {
        this.creating = null;
        aiDebug('service:session-create-failed', {
          elapsedMs: aiElapsedMs(createStart),
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      });
    return this.creating;
  }
}

function parseResponse(raw: string): AiResponse {
  try {
    const parsed = JSON.parse(raw) as AiResponse;
    if (!parsed.action || typeof parsed.action.type !== 'string') {
      parsed.action = { type: 'none' };
    }
    if (
      !ALLOW_DESTRUCTIVE &&
      (parsed.action.type === 'delete_page' ||
        parsed.action.type === 'move_page')
    ) {
      parsed.action = { type: 'none' };
    }
    return parsed;
  } catch {
    return { message: raw, action: { type: 'none' } };
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAutoFetchAction(
  action: AiAction,
): action is AiAction & { type: 'fetch_url' | 'fetch_imdb_show' } {
  return action.type === 'fetch_url' || action.type === 'fetch_imdb_show';
}

/** Dedupe key for the per-turn fetched-keys set — case-insensitive on the target. */
function makeFetchKey(action: AiAction): string {
  if (action.type === 'fetch_url') {
    return `fetch_url:${(action.url ?? '').trim().toLowerCase()}`;
  }
  return `fetch_imdb_show:${(action.imdbId ?? '').trim().toLowerCase()}:${(action.showQuery ?? '').trim().toLowerCase()}`;
}

function buildNoRefetchNudge(type: 'fetch_url' | 'fetch_imdb_show'): string {
  const tool = type === 'fetch_imdb_show' ? 'IMDb show details' : 'URL fetch';
  return `[System guidance]\nYou already received ${tool} results in this conversation.\nDo not request the same fetch again.\nNow answer the user directly with action.type = "none" unless they explicitly ask for another lookup.`;
}

function formatFetchAsUserTurn(fetched: FetchUrlResult, fetchesLeft: number): string {
  const limitHint =
    fetchesLeft === 0
      ? '\n\nNote: no more fetches available this turn. Use this content to propose a concrete action.'
      : `\n\nNote: you have ${fetchesLeft} more fetches available this turn if you need them.`;
  return `[Fetch result]
URL: ${fetched.url}
${fetched.title ? `Title: ${fetched.title}\n` : ''}Content-Type: ${fetched.contentType}
Truncated: ${fetched.truncated}

[Content]
${fetched.text}${limitHint}`;
}

function formatImdbAsUserTurn(
  fetched: ImdbShowDetailsResult,
  fetchesLeft: number,
): string {
  const limitHint =
    fetchesLeft === 0
      ? '\n\nNote: no more fetches available this turn. Use this content to propose a concrete action.'
      : `\n\nNote: you have ${fetchesLeft} more fetches available this turn if you need them.`;
  return `[IMDb show details]
Title: ${fetched.title}
IMDb ID: ${fetched.imdbId}
URL: ${fetched.url}
${fetched.rating !== undefined ? `Rating: ${fetched.rating}\n` : ''}${fetched.votes !== undefined ? `Votes: ${fetched.votes}\n` : ''}${fetched.seasons !== undefined ? `Seasons: ${fetched.seasons}\n` : ''}
[Synopsis]
${fetched.synopsis || '(No synopsis available)'}${limitHint}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
