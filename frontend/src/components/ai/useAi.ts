/**
 * useAi — hook that owns the AI chat session, message log, action execution,
 * and the fetch_url agent loop.
 *
 * Session is held across the hook's lifetime via useRef so it survives re-renders.
 * Messages carry an optional proposed action which the user can Apply or Discard
 * — except for fetch_url actions, which the hook executes automatically and folds
 * the response back into a follow-up turn (capped to prevent runaway loops).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AiSession,
  type AiAction,
  type AiResponse,
  type AiUsage,
  getAiAvailability,
} from '../../services/AiService';
import { buildRagContext } from '../../services/AiContextLoader';
import { apiClient } from '../../config/api';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type ActionStatus = 'pending' | 'applying' | 'applied' | 'discarded' | 'failed';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  action?: AiAction;
  actionStatus?: ActionStatus;
  actionError?: string;
  toolMeta?: { url: string; bytes: number; truncated: boolean };
}

export type AiAvailability = LanguageModelAvailability | 'unsupported';

interface SendArgs {
  text: string;
  currentPageGuid?: string | null;
}

const MAX_FETCHES_PER_TURN = 3;

export function useAi() {
  const sessionRef = useRef<AiSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [availability, setAvailability] = useState<AiAvailability | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    getAiAvailability().then((a) => {
      if (!cancelled) setAvailability(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  const send = useCallback(async ({ text, currentPageGuid }: SendArgs) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    if (!sessionRef.current) {
      sessionRef.current = new AiSession();
    }

    setMessages((m) => [...m, { id: makeId(), role: 'user', text: trimmed }]);
    setIsThinking(true);

    try {
      const ragContext = await buildRagContext({
        currentPageGuid: currentPageGuid ?? null,
        userMessage: trimmed,
      });

      let response: AiResponse = await sessionRef.current.send(
        trimmed,
        ragContext || undefined,
      );

      let fetchesRemaining = MAX_FETCHES_PER_TURN;

      while (response.action.type === 'fetch_url' && fetchesRemaining > 0) {
        const url = (response.action.url || '').trim();
        if (!url) {
          appendAssistant(setMessages, response.message);
          appendSystem(setMessages, 'AI requested fetch_url but provided no URL.');
          break;
        }

        appendAssistant(setMessages, response.message || `Fetching ${url}…`);

        let fetched: FetchUrlResult;
        try {
          fetched = await callFetchProxy(url);
        } catch (err) {
          appendSystem(setMessages, `Fetch failed: ${(err as Error).message}`);
          break;
        }

        appendToolResult(setMessages, fetched);
        fetchesRemaining -= 1;

        const followUp = formatFetchAsUserTurn(fetched, fetchesRemaining);
        response = await sessionRef.current.send(followUp);
      }

      if (response.action.type === 'fetch_url' && fetchesRemaining === 0) {
        appendAssistant(setMessages, response.message);
        appendSystem(
          setMessages,
          'Reached the fetch-per-turn limit. Ask me again if you need more URLs.',
        );
      } else if (response.action.type !== 'fetch_url') {
        setMessages((m) => [
          ...m,
          {
            id: makeId(),
            role: 'assistant',
            text: response.message,
            action: response.action.type !== 'none' ? response.action : undefined,
            actionStatus: response.action.type !== 'none' ? 'pending' : undefined,
          },
        ]);
      }

      setUsage(sessionRef.current.getUsage());
    } catch (err) {
      appendSystem(setMessages, `AI error: ${(err as Error).message}`);
    } finally {
      setIsThinking(false);
    }
  }, [isThinking]);

  const reset = useCallback(async () => {
    await sessionRef.current?.reset();
    setMessages([]);
    setUsage(null);
  }, []);

  const applyAction = useCallback(async (messageId: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (!target?.action) return;

    setMessages((all) =>
      all.map((m) => (m.id === messageId ? { ...m, actionStatus: 'applying' } : m)),
    );

    try {
      await executeAction(target.action);
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setMessages((all) =>
        all.map((m) => (m.id === messageId ? { ...m, actionStatus: 'applied' } : m)),
      );
    } catch (err) {
      setMessages((all) =>
        all.map((m) =>
          m.id === messageId
            ? { ...m, actionStatus: 'failed', actionError: (err as Error).message }
            : m,
        ),
      );
    }
  }, [messages, queryClient]);

  const discardAction = useCallback((messageId: string) => {
    setMessages((all) =>
      all.map((m) => (m.id === messageId ? { ...m, actionStatus: 'discarded' } : m)),
    );
  }, []);

  return {
    messages,
    usage,
    isThinking,
    availability,
    send,
    reset,
    applyAction,
    discardAction,
  };
}

interface FetchUrlResult {
  url: string;
  title?: string;
  text: string;
  contentType: string;
  truncated: boolean;
}

async function callFetchProxy(url: string): Promise<FetchUrlResult> {
  const response = await apiClient.post('/fetch-url', { url });
  return response.data as FetchUrlResult;
}

function formatFetchAsUserTurn(fetched: FetchUrlResult, fetchesLeft: number): string {
  const limitHint = fetchesLeft === 0
    ? '\n\nNote: no more fetches available this turn. Use this content to propose a concrete action.'
    : `\n\nNote: you have ${fetchesLeft} more fetches available this turn if you need them.`;
  return `[Fetch result]
URL: ${fetched.url}
${fetched.title ? `Title: ${fetched.title}\n` : ''}Content-Type: ${fetched.contentType}
Truncated: ${fetched.truncated}

[Content]
${fetched.text}${limitHint}`;
}

function appendAssistant(
  setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  text: string,
) {
  setter((m) => [...m, { id: makeId(), role: 'assistant', text }]);
}

function appendSystem(
  setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  text: string,
) {
  setter((m) => [...m, { id: makeId(), role: 'system', text }]);
}

function appendToolResult(
  setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  fetched: FetchUrlResult,
) {
  setter((m) => [
    ...m,
    {
      id: makeId(),
      role: 'tool',
      text: fetched.title || fetched.url,
      toolMeta: {
        url: fetched.url,
        bytes: fetched.text.length,
        truncated: fetched.truncated,
      },
    },
  ]);
}

async function executeAction(action: AiAction): Promise<void> {
  switch (action.type) {
    case 'create_page': {
      if (!action.title) throw new Error('Missing title for create_page');
      await apiClient.post('/pages', {
        title: action.title,
        content: action.content ?? '',
        parentGuid: action.parentGuid ?? null,
        tags: action.tags ?? [],
      });
      return;
    }
    case 'update_page': {
      if (!action.pageGuid) throw new Error('Missing pageGuid for update_page');
      const payload: Record<string, unknown> = {};
      if (action.title !== undefined) payload.title = action.title;
      if (action.content !== undefined) payload.content = action.content;
      if (action.tags !== undefined) payload.tags = action.tags;
      if (Object.keys(payload).length === 0) throw new Error('Nothing to update');
      await apiClient.put(`/pages/${action.pageGuid}`, payload);
      return;
    }
    case 'delete_page': {
      if (!action.pageGuid) throw new Error('Missing pageGuid for delete_page');
      await apiClient.delete(`/pages/${action.pageGuid}`, {
        data: { recursive: action.recursive ?? false },
      });
      return;
    }
    case 'move_page': {
      if (!action.pageGuid) throw new Error('Missing pageGuid for move_page');
      await apiClient.put(`/pages/${action.pageGuid}/move`, {
        newParentGuid: action.newParentGuid ?? null,
      });
      return;
    }
    case 'fetch_url':
    case 'none':
      return;
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
