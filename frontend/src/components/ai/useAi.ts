/**
 * useAi — hook that owns the AI chat session, message log, and action execution.
 *
 * Session is held across the hook's lifetime via useRef so it survives re-renders
 * without being recreated. Messages carry an optional proposed action which the
 * user can Apply or Discard from the sidebar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AiSession, type AiAction, type AiUsage, getAiAvailability } from '../../services/AiService';
import { buildRagContext } from '../../services/AiContextLoader';
import { apiClient } from '../../config/api';

export type ChatRole = 'user' | 'assistant' | 'system';

export type ActionStatus = 'pending' | 'applying' | 'applied' | 'discarded' | 'failed';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  action?: AiAction;
  actionStatus?: ActionStatus;
  actionError?: string;
}

export type AiAvailability = LanguageModelAvailability | 'unsupported';

interface SendArgs {
  text: string;
  currentPageGuid?: string | null;
}

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

    const userMessageId = makeId();
    setMessages((m) => [...m, { id: userMessageId, role: 'user', text: trimmed }]);
    setIsThinking(true);

    try {
      const ragContext = await buildRagContext({
        currentPageGuid: currentPageGuid ?? null,
        userMessage: trimmed,
      });

      const response = await sessionRef.current.send(trimmed, ragContext || undefined);

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
      setUsage(sessionRef.current.getUsage());
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: makeId(),
          role: 'system',
          text: `AI error: ${(err as Error).message}`,
        },
      ]);
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
    case 'none':
      return;
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
