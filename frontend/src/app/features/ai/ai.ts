/**
 * Ai — wraps Chrome's on-device Prompt API (Gemini Nano) for the wiki, with
 * signal-backed state for messages / context-window usage / current action.
 *
 * Ports `frontend/src/services/AiService.ts` (273 lines) — schema, system
 * prompt, JSON parsing, ALLOW_DESTRUCTIVE gating — and folds the React
 * `useAi` orchestration of message log + action lifecycle into a single
 * Angular service. RAG context loading + action execution live in the
 * sidebar component for now; the React hook also handled the auto-fetch
 * tool loop which can land later (it is not in Phase 7's scope).
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { aiDebug, aiElapsedMs, aiNow } from './ai-debug';

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

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  action?: AiAction;
  actionStatus?: ActionStatus;
  actionError?: string;
}

export type AiAvailability = LanguageModelAvailability | 'unsupported';

const PROMPT_OUTPUT_LANGUAGE = 'en' as const;

@Injectable({ providedIn: 'root' })
export class Ai {
  // HttpClient is injected for action execution; action handlers live alongside
  // the rest of the AI surface (used in Phase 7 by ActionPreview/AiSidebar).
  private readonly http = inject(HttpClient);

  private readonly _messages = signal<readonly ChatMessage[]>([]);
  private readonly _inputUsage = signal<number>(0);
  private readonly _inputQuota = signal<number>(0);
  private readonly _streaming = signal<boolean>(false);
  private readonly _currentAction = signal<AiAction | null>(null);
  private readonly _currentActionMessageId = signal<string | null>(null);

  readonly messages = computed(() => this._messages());
  readonly inputUsage = computed(() => this._inputUsage());
  readonly inputQuota = computed(() => this._inputQuota());
  readonly streaming = computed(() => this._streaming());
  readonly currentAction = computed(() => this._currentAction());

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
   * `ragContext` is optional and prefixed onto the user turn — never as a
   * second system message (Chrome's Prompt API rejects that).
   */
  async sendMessage(userMessage: string, ragContext?: string): Promise<AiResponse> {
    const startedAt = aiNow();
    aiDebug('service:send-start', {
      messageChars: userMessage.length,
      contextChars: ragContext?.length ?? 0,
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

    try {
      const session = await this.ensureSession();
      const combined = ragContext
        ? `[Context]\n${ragContext}\n\n[Message]\n${trimmed}`
        : trimmed;

      const promptStart = aiNow();
      const promptOptions: LanguageModelPromptOptions & {
        outputLanguage: 'en';
      } = {
        responseConstraint: RESPONSE_SCHEMA,
        outputLanguage: PROMPT_OUTPUT_LANGUAGE,
      };

      let raw: string;
      try {
        raw = await session.prompt(combined, promptOptions);
        aiDebug('service:prompt-success', {
          elapsedMs: aiElapsedMs(promptStart),
          rawChars: raw.length,
        });
      } catch (err) {
        aiDebug('service:prompt-failed', {
          elapsedMs: aiElapsedMs(startedAt),
          error: (err as Error).message,
        });
        throw new Error(`Prompt API call failed: ${(err as Error).message}`, {
          cause: err,
        });
      }

      const parsed = parseResponse(raw);

      this._inputUsage.set(session.inputUsage);
      this._inputQuota.set(session.inputQuota);

      const assistantId = makeId();
      const action =
        parsed.action.type !== 'none' ? parsed.action : undefined;
      this._messages.update((list) => [
        ...list,
        {
          id: assistantId,
          role: 'assistant',
          text: parsed.message,
          action,
          actionStatus: action ? 'pending' : undefined,
        },
      ]);

      if (action) {
        this._currentAction.set(action);
        this._currentActionMessageId.set(assistantId);
      } else {
        this._currentAction.set(null);
        this._currentActionMessageId.set(null);
      }

      aiDebug('service:send-complete', {
        elapsedMs: aiElapsedMs(startedAt),
        actionType: parsed.action.type,
      });
      return parsed;
    } finally {
      this._streaming.set(false);
    }
  }

  /**
   * Mark the current action as accepted. Returns the accepted action so the
   * caller can dispatch the matching HTTP mutation. Clears `currentAction`.
   */
  acceptAction(): AiAction | null {
    const action = this._currentAction();
    const messageId = this._currentActionMessageId();
    if (!action || !messageId) return null;
    this.updateMessage(messageId, { actionStatus: 'applied' });
    this._currentAction.set(null);
    this._currentActionMessageId.set(null);
    return action;
  }

  /** Mark the current action as failed with the given error message. */
  markActionFailed(error: string): void {
    const messageId = this._currentActionMessageId();
    if (!messageId) return;
    this.updateMessage(messageId, {
      actionStatus: 'failed',
      actionError: error,
    });
    this._currentAction.set(null);
    this._currentActionMessageId.set(null);
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
    return Promise.resolve();
  }

  /** Exposed for ActionPreview's apply path. */
  get httpClient(): HttpClient {
    return this.http;
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
