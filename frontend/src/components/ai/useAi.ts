/**
 * useAi — hook that owns the AI chat session, message log, action execution,
 * and the automatic fetch tool loop (fetch_url + IMDb lookups).
 *
 * Session is held across the hook's lifetime via useRef so it survives re-renders.
 * Messages carry an optional proposed action which the user can Apply or Discard
 * — except for fetch actions, which the hook executes automatically and folds
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
import { getInstructionContent } from '../../services/AiInstructionsService';
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
  // Instructions the user has chosen to attach to the chat. Stays across
  // turns and across "New chat" resets — selection is a UI preference.
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  // Instructions already injected into the current session's history. Once
  // here, the model has them; deselecting can't undo that. Cleared by reset.
  const [loadedInstructions, setLoadedInstructions] = useState<string[]>([]);
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
      const toInject = selectedInstructions.filter(
        (guid) => !loadedInstructions.includes(guid),
      );

      const [ragContext, instructionsBlock] = await Promise.all([
        buildRagContext({
          currentPageGuid: currentPageGuid ?? null,
          userMessage: trimmed,
        }),
        buildInstructionsBlock(toInject),
      ]);

      if (toInject.length > 0) {
        setLoadedInstructions((prev) => [...prev, ...toInject]);
      }

      const combinedContext = [instructionsBlock, ragContext]
        .filter((s) => s && s.length > 0)
        .join('\n\n');

      let response: AiResponse = await sessionRef.current.send(
        trimmed,
        combinedContext || undefined,
      );

      let fetchesRemaining = MAX_FETCHES_PER_TURN;

      while (isAutoFetchAction(response.action.type) && fetchesRemaining > 0) {
        if (response.action.type === 'fetch_url') {
          const url = (response.action.url || '').trim();
          if (!url) {
            appendAssistant(setMessages, response.message);
            appendSystem(setMessages, 'AI requested fetch_url but provided no URL.');
            break;
          }

          appendAssistant(setMessages, response.message || `Fetching ${url}...`);

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
          continue;
        }

        const showQuery = (response.action.showQuery || '').trim();
        const imdbId = (response.action.imdbId || '').trim();
        if (!showQuery && !imdbId) {
          appendAssistant(setMessages, response.message);
          appendSystem(setMessages, 'AI requested fetch_imdb_show but provided no showQuery or imdbId.');
          break;
        }

        appendAssistant(
          setMessages,
          response.message
            || `Fetching IMDb details for ${showQuery || imdbId}...`,
        );

        let fetchedImdb: ImdbShowDetailsResult;
        try {
          fetchedImdb = await callImdbShowDetailsProxy({
            query: showQuery || undefined,
            imdbId: imdbId || undefined,
          });
        } catch (err) {
          appendSystem(setMessages, `IMDb lookup failed: ${(err as Error).message}`);
          break;
        }

        appendImdbToolResult(setMessages, fetchedImdb);
        fetchesRemaining -= 1;

        const followUp = formatImdbAsUserTurn(fetchedImdb, fetchesRemaining);
        response = await sessionRef.current.send(followUp);
      }

      if (isAutoFetchAction(response.action.type) && fetchesRemaining === 0) {
        appendAssistant(setMessages, response.message);
        appendSystem(
          setMessages,
          'Reached the fetch-per-turn limit. Ask me again if you need more URLs.',
        );
      } else if (!isAutoFetchAction(response.action.type)) {
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
  }, [isThinking, selectedInstructions, loadedInstructions]);

  const reset = useCallback(async () => {
    await sessionRef.current?.reset();
    setMessages([]);
    setUsage(null);
    setLoadedInstructions([]);
  }, []);

  const toggleInstruction = useCallback((guid: string) => {
    setSelectedInstructions((prev) =>
      prev.includes(guid) ? prev.filter((g) => g !== guid) : [...prev, guid],
    );
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
    selectedInstructions,
    loadedInstructions,
    toggleInstruction,
  };
}

async function buildInstructionsBlock(guids: string[]): Promise<string> {
  if (guids.length === 0) return '';
  const fetched = await Promise.all(
    guids.map((guid) =>
      getInstructionContent(guid).catch((err) => {
        console.warn(`Failed to load AI instruction ${guid}:`, err);
        return null;
      }),
    ),
  );
  const sections = fetched
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .map((x) => `## ${x.title}\n${x.content.trim()}`);
  if (sections.length === 0) return '';
  return `[Active instructions]\nThe user has attached the following instructions to this chat. Follow them for this and subsequent turns.\n\n${sections.join('\n\n')}`;
}

interface FetchUrlResult {
  url: string;
  title?: string;
  text: string;
  contentType: string;
  truncated: boolean;
}

interface ImdbShowDetailsResult {
  query?: string;
  imdbId: string;
  title: string;
  synopsis: string;
  seasons?: number;
  rating?: number;
  votes?: number;
  url: string;
}

async function callFetchProxy(url: string): Promise<FetchUrlResult> {
  const response = await apiClient.post('/fetch-url', { url });
  return response.data as FetchUrlResult;
}

async function callImdbShowDetailsProxy(payload: {
  query?: string;
  imdbId?: string;
}): Promise<ImdbShowDetailsResult> {
  const response = await apiClient.post('/imdb/show-details', payload);
  return response.data as ImdbShowDetailsResult;
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

function formatImdbAsUserTurn(fetched: ImdbShowDetailsResult, fetchesLeft: number): string {
  const limitHint = fetchesLeft === 0
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

function isAutoFetchAction(type: AiAction['type']): type is 'fetch_url' | 'fetch_imdb_show' {
  return type === 'fetch_url' || type === 'fetch_imdb_show';
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

function appendImdbToolResult(
  setter: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  fetched: ImdbShowDetailsResult,
) {
  setter((m) => [
    ...m,
    {
      id: makeId(),
      role: 'tool',
      text: fetched.title || fetched.url,
      toolMeta: {
        url: fetched.url,
        bytes: fetched.synopsis.length,
        truncated: false,
      },
    },
  ]);
}

function normalizeProperties(
  raw?: Record<string, unknown>
): Record<string, { type: string; value: unknown }> | undefined {
  if (!raw || Object.keys(raw).length === 0) return undefined;

  const result: Record<string, { type: string; value: unknown }> = {};

  for (const [key, value] of Object.entries(raw)) {
    // Already wrapped correctly
    if (typeof value === 'object' && value !== null && 'type' in value && 'value' in value) {
      result[key] = value as { type: string; value: unknown };
    } else {
      // Infer type from bare value
      let inferredType = 'string';
      if (Array.isArray(value)) {
        inferredType = 'tags';
      } else if (typeof value === 'number') {
        inferredType = 'number';
      } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        inferredType = 'date';
      }
      result[key] = { type: inferredType, value };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

async function executeAction(action: AiAction): Promise<void> {
  switch (action.type) {
    case 'create_page': {
      if (!action.title) throw new Error('Missing title for create_page');
      const normalizedProps = normalizeProperties(action.pageProperties);
      const serviceValue = normalizedProps?.service?.value;
      const inferredServiceTags = Array.isArray(serviceValue)
        ? serviceValue.map((v) => String(v).toLowerCase())
        : [];
      const requestedTags = (action.tags ?? []).map((t) => t.toLowerCase());
      const tagsMatchService =
        inferredServiceTags.length > 0
        && requestedTags.length === inferredServiceTags.length
        && requestedTags.every((t) => inferredServiceTags.includes(t));

      await apiClient.post('/pages', {
        title: action.title,
        content: action.content ?? '',
        parentGuid: action.parentGuid ?? null,
        tags: tagsMatchService ? [] : (action.tags ?? []),
        ...(action.pageType ? { pageType: action.pageType } : {}),
        ...(normalizedProps ? { properties: normalizedProps } : {}),
      });
      return;
    }
    case 'update_page': {
      if (!action.pageGuid) throw new Error('Missing pageGuid for update_page');
      const payload: Record<string, unknown> = {};
      if (action.title !== undefined) payload.title = action.title;
      if (action.content !== undefined) payload.content = action.content;
      if (action.tags !== undefined) payload.tags = action.tags;
      if (action.pageType !== undefined) payload.pageType = action.pageType;
      if (action.pageProperties !== undefined) {
        const normalizedProps = normalizeProperties(action.pageProperties);
        if (normalizedProps) payload.properties = normalizedProps;
      }
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
    case 'fetch_imdb_show':
    case 'none':
      return;
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
