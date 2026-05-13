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
 */

const SYSTEM_PROMPT = `You are the BlueFinWiki assistant. You help the user navigate, edit, and create wiki pages.

The wiki stores pages with: title (string), content (markdown), tags (string[]), parent page (for hierarchy), and a GUID identifier. You will be given the current page the user is viewing and a list of semantically related pages in each turn.

You respond with one JSON object: { "message": "...", "action": { ... } }.

"message" is a short, helpful reply to the user (1-3 sentences). Keep it terse.

"action.type" must be one of:
- "none" — chat-only reply, no wiki change
- "create_page" — propose a new page. Provide title, content (markdown), optional parentGuid, optional tags
- "update_page" — propose changes to an existing page. Provide pageGuid plus any of: title, content, tags
- "delete_page" — propose deletion. Provide pageGuid, and recursive=true if it has children. DESTRUCTIVE — only when the user clearly asks
- "move_page" — propose reparenting. Provide pageGuid and newParentGuid (or null for root)

Rules:
- Never invent a pageGuid. Only use GUIDs given to you in the context.
- For create_page, parentGuid is optional — omit for a root page, or use the current page's GUID for a child.
- For destructive actions (delete, move), warn briefly in "message" so the user knows what they are confirming.
- If you don't have enough info to act, ask a clarifying question with action.type = "none".
- Default to "none" when in doubt — the user reviews every proposed change.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    action: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['none', 'create_page', 'update_page', 'delete_page', 'move_page'],
        },
        title: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        pageGuid: { type: 'string' },
        parentGuid: { type: ['string', 'null'] },
        newParentGuid: { type: ['string', 'null'] },
        recursive: { type: 'boolean' },
      },
      required: ['type'],
      additionalProperties: false,
    },
  },
  required: ['message', 'action'],
  additionalProperties: false,
} as const;

export type AiActionType =
  | 'none'
  | 'create_page'
  | 'update_page'
  | 'delete_page'
  | 'move_page';

export interface AiAction {
  type: AiActionType;
  title?: string;
  content?: string;
  tags?: string[];
  pageGuid?: string;
  parentGuid?: string | null;
  newParentGuid?: string | null;
  recursive?: boolean;
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
