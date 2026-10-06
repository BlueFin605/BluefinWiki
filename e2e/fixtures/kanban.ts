import { mkdir, rmdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { API_BASE_URL, AUTH_HEADER } from './api';
import { createPageType, deletePageType, allowChildTypes } from './page-types';

/**
 * Shared helpers for the specs that drive the kanban_* MCP tools.
 *
 * The tools look page types up by their exact names (Initiative/Epic/Story/
 * Task), so these specs can't use the usual run-id prefix: each removes any
 * leftover types with those names, creates its own, and deletes them on the
 * way out. Two such specs running at once in different workers would delete
 * each other's types, so {@link withTicketTypes} holds a cross-worker lock.
 */
export const TICKET_TYPES = ['Initiative', 'Epic', 'Story', 'Task'] as const;
export type TicketTypeGuids = Record<(typeof TICKET_TYPES)[number], string>;

export async function callTool(request: APIRequestContext, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/mcp`, {
    headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
  const text = body.result.content[0].text;
  if (body.result.isError) throw new Error(`${name} failed: ${text}`);
  return text;
}

/** "Type · State · Title · guid-or-key[ · #tags]" → guid-or-key */
export const refOf = (line: string): string => line.split(' · ').filter((p) => !p.startsWith('#')).pop()!;

async function removeTicketTypes(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_BASE_URL}/page-types`, { headers: AUTH_HEADER });
  const { pageTypes } = (await res.json()) as { pageTypes: { guid: string; name: string }[] };
  for (const t of pageTypes) {
    if ((TICKET_TYPES as readonly string[]).includes(t.name)) await deletePageType(request, t.guid);
  }
}

const LOCK_DIR = join(tmpdir(), 'bluefinwiki-e2e-ticket-types.lock');
const STALE_LOCK_MS = 5 * 60_000;

async function acquireLock(): Promise<void> {
  for (;;) {
    try {
      await mkdir(LOCK_DIR);
      return;
    } catch {
      // Held by another worker — or left behind by a crashed run.
      const held = await stat(LOCK_DIR).catch(() => null);
      if (held && Date.now() - held.mtimeMs > STALE_LOCK_MS) await rmdir(LOCK_DIR).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/**
 * Create fresh Initiative/Epic/Story/Task types (each with a required
 * `state` property, nested Initiative › Epic › Story › Task), run `fn`, then
 * delete them — holding the cross-worker lock throughout.
 */
export async function withTicketTypes(
  request: APIRequestContext,
  fn: (types: TicketTypeGuids) => Promise<void>,
): Promise<void> {
  await acquireLock();
  const types = {} as TicketTypeGuids;
  try {
    await removeTicketTypes(request);
    const state = [{ name: 'state', type: 'string' as const, required: true }];
    for (const name of TICKET_TYPES) types[name] = await createPageType(request, name, { properties: state });
    await allowChildTypes(request, types.Initiative, [types.Epic]);
    await allowChildTypes(request, types.Epic, [types.Story]);
    await allowChildTypes(request, types.Story, [types.Task]);
    await fn(types);
  } finally {
    try {
      for (const guid of Object.values(types)) await deletePageType(request, guid);
    } finally {
      await rmdir(LOCK_DIR).catch(() => undefined);
    }
  }
}
