/**
 * AiService — wraps Chrome's on-device Prompt API (Gemini Nano) for the wiki.
 *
 * Design notes:
 * - One concatenated system prompt (Prompt API rejects multiple system entries).
 * - outputLanguage is always set to silence the per-call console warning.
 * - Persistent session pattern: callers reuse a single session across turns;
 *   inputUsage/inputQuota is exposed so UI can render a context-window meter.
 * - Structured output via responseConstraint with explicit `required` fields so
 *   Gemini Nano doesn't silently skip them. JSON.parse happens here, not in the UI.
 * - Action vocabulary mirrors the wiki MCP tool surface so both AI paths agree
 *   on what an "edit", "create", "delete", "move" looks like.
 * - VITE_AI_ALLOW_DESTRUCTIVE='false' strips delete_page/move_page from both the
 *   schema and the system prompt — for demo deployments where the wiki is
 *   exposed to anonymous users and prompt-injection mitigations matter.
 */

const ALLOW_DESTRUCTIVE = import.meta.env.VITE_AI_ALLOW_DESTRUCTIVE !== 'false';

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
  pageProperties?: Record<string, { type: string; value: string | number | string[] }>;
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

export interface AiUsage {
  used: number;
  quota: number;
  percent: number;
}

export const aiAllowsDestructive = ALLOW_DESTRUCTIVE;

export async function getAiAvailability(): Promise<LanguageModelAvailability | 'unsupported'> {
  if (typeof LanguageModel === 'undefined') return 'unsupported';
  try {
    return await LanguageModel.availability();
  } catch (err) {
    console.warn('LanguageModel.availability() failed:', err);
    return 'unsupported';
  }
}

export class AiSession {
  private session: LanguageModelSession | null = null;
  private creating: Promise<LanguageModelSession> | null = null;

  async send(userMessage: string, ragContext?: string): Promise<AiResponse> {
    const session = await this.ensureSession();

    const combined = ragContext
      ? `[Context]\n${ragContext}\n\n[Message]\n${userMessage}`
      : userMessage;

    let raw: string;
    try {
      raw = await session.prompt(combined, { responseConstraint: RESPONSE_SCHEMA });
    } catch (err) {
      throw new Error(`Prompt API call failed: ${(err as Error).message}`);
    }

    try {
      const parsed = JSON.parse(raw) as AiResponse;
      if (!parsed.action || typeof parsed.action.type !== 'string') {
        parsed.action = { type: 'none' };
      }
      if (!ALLOW_DESTRUCTIVE && (parsed.action.type === 'delete_page' || parsed.action.type === 'move_page')) {
        parsed.action = { type: 'none' };
      }
      return parsed;
    } catch {
      return { message: raw, action: { type: 'none' } };
    }
  }

  getUsage(): AiUsage | null {
    if (!this.session) return null;
    const used = this.session.inputUsage;
    const quota = this.session.inputQuota;
    if (!quota) return null;
    return { used, quota, percent: Math.min(100, (used / quota) * 100) };
  }

  async reset(): Promise<void> {
    if (this.session) {
      try {
        this.session.destroy();
      } catch (err) {
        console.warn('Failed to destroy session:', err);
      }
      this.session = null;
    }
  }

  destroy(): void {
    if (this.session) {
      try {
        this.session.destroy();
      } catch {
        // ignore
      }
      this.session = null;
    }
  }

  private async ensureSession(): Promise<LanguageModelSession> {
    if (this.session) return this.session;
    if (this.creating) return this.creating;
    if (typeof LanguageModel === 'undefined') {
      throw new Error('LanguageModel is not available in this browser');
    }
    this.creating = LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      outputLanguage: 'en',
    }).then((s) => {
      this.session = s;
      this.creating = null;
      return s;
    }).catch((err) => {
      this.creating = null;
      throw err;
    });
    return this.creating;
  }
}
