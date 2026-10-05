/**
 * MCP Kanban tools — treat an Initiative page and its typed descendants
 * (Epic / Story / Task, any page type with a `state` property) as a Kanban board.
 *
 * Tree walking, next-ticket selection and parent roll-up happen here, server-side,
 * so AI clients get one compact plain-text answer per call instead of browsing
 * pages themselves. Work happens on leaf tickets; parents close when all their
 * ticket children are Done.
 */

import { PageContent, PageSummary } from '../../../types/index.js';
import { KanbanDeps, KanbanPageType } from './deps.js';

/** `Waiting for Action` = a manual (#dean) ticket that is due now — Dean's to-do list. */
export const STATES = ['Backlog', 'Ready', 'In Progress', 'Waiting for Action', 'Blocked', 'Done'] as const;
const INITIATIVE = 'Initiative';
const COMMENT_LIMIT = 5;
const SKIP_SUBTREE = new Set(['Waiting for Action', 'Blocked', 'Done']);

interface Ticket {
  guid: string;
  title: string;
  type: string;
  state: string;
  tags: string[];
  children: Ticket[];
}

export interface CreateNode {
  type: string;
  title: string;
  body?: string;
  state?: string;
  tags?: string[];
  children?: CreateNode[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TypeInfo {
  byGuid: Map<string, KanbanPageType>;
  byName: Map<string, KanbanPageType>;
}

async function loadTypes(deps: KanbanDeps): Promise<TypeInfo> {
  const types = (await deps.listPageTypes()).filter(t => t.propertyNames.includes('state'));
  return {
    byGuid: new Map(types.map(t => [t.guid, t])),
    byName: new Map(types.map(t => [t.name.toLowerCase(), t])),
  };
}

function stateOf(page: Pick<PageSummary, 'properties'>): string {
  return String(page.properties?.state?.value ?? '');
}

function line(t: { type: string; state: string; title: string; guid: string; tags?: string[] }): string {
  const tags = t.tags?.length ? ` · ${t.tags.map(tag => `#${tag}`).join(' ')}` : '';
  return `${t.type} · ${t.state} · ${t.title} · ${t.guid}${tags}`;
}

function checkState(state: string | undefined): void {
  if (state !== undefined && !(STATES as readonly string[]).includes(state)) {
    throw new Error(`unknown state "${state}"; valid: ${STATES.join('|')}`);
  }
}

/** Trim, lower-case and de-duplicate tags; rejects anything but non-empty strings. */
function normaliseTags(tags: unknown): string[] {
  if (tags === undefined) return [];
  if (!Array.isArray(tags)) throw new Error('tags must be an array of strings');
  const out: string[] = [];
  for (const tag of tags) {
    const t = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
    if (!t) throw new Error(`invalid tag ${JSON.stringify(tag)}; tags must be non-empty strings`);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Load a page and require it to be a ticket; returns the page and its type name. */
async function loadTicket(deps: KanbanDeps, types: TypeInfo, guid: string) {
  const page = await deps.loadPage(guid);
  const type = page.pageType ? types.byGuid.get(page.pageType) : undefined;
  if (!type || page.status !== 'published') throw new Error(`not a ticket: ${page.title}`);
  return { page, type: type.name };
}

async function ticketChildren(deps: KanbanDeps, types: TypeInfo, parentGuid: string): Promise<PageSummary[]> {
  const children = await deps.listChildren(parentGuid);
  return children.filter(c => c.status === 'published' && c.pageType && types.byGuid.has(c.pageType));
}

async function buildTree(deps: KanbanDeps, types: TypeInfo, page: PageSummary | PageContent): Promise<Ticket> {
  const children = await ticketChildren(deps, types, page.guid);
  return {
    guid: page.guid,
    title: page.title,
    type: types.byGuid.get(page.pageType!)!.name,
    state: stateOf(page),
    tags: page.tags ?? [],
    children: await Promise.all(children.map(c => buildTree(deps, types, c))),
  };
}

async function loadInitiative(deps: KanbanDeps, types: TypeInfo, guid: string): Promise<Ticket> {
  const page = await deps.loadPage(guid);
  const type = page.pageType ? types.byGuid.get(page.pageType) : undefined;
  if (type?.name !== INITIATIVE) throw new Error(`not an Initiative: ${page.title}`);
  return buildTree(deps, types, page);
}

function descendants(t: Ticket): Ticket[] {
  return t.children.flatMap(c => [c, ...descendants(c)]);
}

async function setStateOn(deps: KanbanDeps, guid: string, state: string): Promise<void> {
  await deps.updatePage({ pageGuid: guid, properties: { state: { type: 'string', value: state } } });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * kanban_initiatives — Initiatives (one per feature board) with state and
 * open-ticket count. Done initiatives are hidden unless includeDone.
 */
export async function kanbanInitiatives(
  deps: KanbanDeps,
  input: { includeDone?: boolean } = {},
): Promise<string> {
  const types = await loadTypes(deps);
  const found: string[] = [];

  async function walk(parentGuid: string | null): Promise<void> {
    for (const page of await deps.listChildren(parentGuid)) {
      if (page.status !== 'published') continue;
      if (page.pageType && types.byGuid.get(page.pageType)?.name === INITIATIVE) {
        const state = stateOf(page);
        if (state === 'Done' && !input.includeDone) continue;
        const tree = await buildTree(deps, types, page);
        const open = descendants(tree).filter(t => t.state !== 'Done').length;
        found.push(`${page.guid} · ${page.title} · ${state} · ${open} open`);
      } else if (page.hasChildren) {
        await walk(page.guid);
      }
    }
  }

  await walk(null);
  return found.length ? found.join('\n') : 'no initiatives found';
}

/** kanban_get — a ticket card: header, ancestor path, body, recent comments. */
export async function kanbanGet(deps: KanbanDeps, input: { guid: string }): Promise<string> {
  const types = await loadTypes(deps);
  const { page, type } = await loadTicket(deps, types, await deps.resolveRef(input.guid));

  const path: string[] = [];
  let parentGuid = type === INITIATIVE ? '' : page.folderId;
  while (parentGuid) {
    const parent = await deps.loadPage(parentGuid);
    path.unshift(parent.title);
    if (parent.pageType && types.byGuid.get(parent.pageType)?.name === INITIATIVE) break;
    parentGuid = parent.folderId;
  }

  const out = [line({ type, state: stateOf(page), title: page.title, guid: page.guid, tags: page.tags })];
  if (path.length) out.push(`Path: ${path.join(' › ')}`);
  out.push('', page.content.trim());

  const comments = (await deps.listComments(page.guid)).filter(c => !c.deletedAt);
  if (comments.length) {
    const recent = comments.slice(-COMMENT_LIMIT);
    out.push('', `-- comments (last ${recent.length} of ${comments.length}) --`);
    for (const c of recent) out.push(`${c.createdAt.slice(0, 10)} ${c.authorName}: ${c.body}`);
  }
  return out.join('\n');
}

/**
 * kanban_next — resume the first In Progress leaf, else the first Ready leaf,
 * in tree order, skipping anything under a Waiting for Action, Blocked or Done ancestor.
 * claim=true moves the picked leaf and its Ready/Backlog ancestors (not the
 * initiative) to In Progress.
 */
export async function kanbanNext(
  deps: KanbanDeps,
  input: { initiative: string; claim?: boolean },
): Promise<string> {
  const types = await loadTypes(deps);
  const root = await loadInitiative(deps, types, await deps.resolveRef(input.initiative));

  function find(node: Ticket, want: string, path: Ticket[]): Ticket[] | null {
    for (const child of node.children) {
      if (SKIP_SUBTREE.has(child.state)) continue;
      if (child.children.length === 0) {
        if (child.state === want) return [...path, child];
      } else {
        const hit = find(child, want, [...path, child]);
        if (hit) return hit;
      }
    }
    return null;
  }

  const chain = find(root, 'In Progress', []) ?? find(root, 'Ready', []);
  if (!chain) {
    const all = descendants(root);
    const counts = STATES
      .map(s => [s, all.filter(t => t.state === s).length] as const)
      .filter(([s, n]) => n > 0 && s !== 'Ready' && s !== 'In Progress')
      .map(([s, n]) => `${n} ${s}`);
    throw new Error(`initiative has no Ready leaves (${counts.join(', ') || 'empty'})`);
  }

  if (input.claim) {
    for (const t of chain) {
      if (t.state === 'Ready' || t.state === 'Backlog') await setStateOn(deps, t.guid, 'In Progress');
    }
  }
  return kanbanGet(deps, { guid: chain[chain.length - 1].guid });
}

/**
 * kanban_board — indented one-line-per-ticket tree, optionally filtered by
 * state and/or tag (a ticket must pass both filters; ancestors of matches stay).
 */
export async function kanbanBoard(
  deps: KanbanDeps,
  input: { initiative: string; states?: string[]; tags?: string[]; depth?: number },
): Promise<string> {
  input.states?.forEach(checkState);
  const types = await loadTypes(deps);
  const root = await loadInitiative(deps, types, await deps.resolveRef(input.initiative));
  const maxDepth = input.depth ?? Infinity;
  const wantedStates = input.states?.length ? new Set(input.states) : null;
  const wantedTags = input.tags?.length ? new Set(normaliseTags(input.tags)) : null;

  const selfMatches = (t: Ticket): boolean =>
    (!wantedStates || wantedStates.has(t.state)) && (!wantedTags || t.tags.some(tag => wantedTags.has(tag)));
  const filtered = wantedStates !== null || wantedTags !== null;
  const matches = (t: Ticket): boolean => !filtered || selfMatches(t) || t.children.some(matches);

  const out: string[] = [];
  function render(t: Ticket, depth: number): void {
    out.push('  '.repeat(depth) + line(t));
    if (depth >= maxDepth) return;
    for (const c of t.children) if (matches(c)) render(c, depth + 1);
  }
  render(root, 0);
  return out.join('\n');
}

/**
 * kanban_create — create a nested tree of tickets under parentGuid in one call.
 * The whole tree is validated before anything is written.
 */
export async function kanbanCreate(
  deps: KanbanDeps,
  input: { parentGuid: string; tree: CreateNode | CreateNode[] },
): Promise<string> {
  const types = await loadTypes(deps);
  const nodes = Array.isArray(input.tree) ? input.tree : [input.tree];
  const parentGuid = await deps.resolveRef(input.parentGuid);
  const parent = await loadTicket(deps, types, parentGuid);

  function validate(list: CreateNode[], parentType: KanbanPageType): void {
    for (const n of list) {
      const type = types.byName.get(String(n.type).toLowerCase());
      if (!type) throw new Error(`unknown ticket type "${n.type}"`);
      if (!n.title?.trim()) throw new Error('title is required');
      if (n.title.length > 200) throw new Error(`title too long: ${n.title.slice(0, 40)}…`);
      checkState(n.state);
      n.tags = normaliseTags(n.tags);
      if (parentType.allowedChildTypes.length && !parentType.allowedChildTypes.includes(type.guid)) {
        throw new Error(`${type.name} is not allowed under ${parentType.name}`);
      }
      validate(n.children ?? [], type);
    }
  }
  validate(nodes, types.byName.get(parent.type.toLowerCase())!);

  const created: string[] = [];
  const out: string[] = [];
  async function write(list: CreateNode[], parentGuid: string, depth: number): Promise<void> {
    for (const n of list) {
      const type = types.byName.get(n.type.toLowerCase())!;
      let guid: string;
      try {
        ({ guid } = await deps.createPage({
          title: n.title,
          content: n.body ?? '',
          parentGuid,
          pageType: type.guid,
          properties: { state: { type: 'string', value: n.state ?? 'Ready' } },
          ...(n.tags?.length ? { tags: n.tags } : {}),
        }));
      } catch (err) {
        throw new Error(`create failed at "${n.title}": ${(err as Error).message}; already created: ${created.join(', ') || 'none'}`);
      }
      created.push(guid);
      out.push(`${'  '.repeat(depth)}${type.name} · ${n.title} · ${guid}`);
      await write(n.children ?? [], guid, depth + 1);
    }
  }
  await write(nodes, parentGuid, 0);
  return out.join('\n');
}

/**
 * kanban_set_state — move a ticket, optionally commenting and adding/removing
 * tags in the same call (tags merge with the existing ones, never replace).
 * On Done, reports the nearest parent whose ticket children are now all Done;
 * rollup=true closes that chain upward instead (never the Initiative itself).
 */
export async function kanbanSetState(
  deps: KanbanDeps,
  input: { guid: string; state: string; comment?: string; rollup?: boolean; addTags?: string[]; removeTags?: string[] },
): Promise<string> {
  checkState(input.state);
  const addTags = normaliseTags(input.addTags);
  const removeTags = normaliseTags(input.removeTags);
  const types = await loadTypes(deps);
  const { page, type } = await loadTicket(deps, types, await deps.resolveRef(input.guid));

  let tags = page.tags ?? [];
  const tagsChanged = input.addTags !== undefined || input.removeTags !== undefined;
  if (tagsChanged) {
    tags = [...tags, ...addTags.filter(t => !tags.includes(t))].filter(t => !removeTags.includes(t));
  }
  await deps.updatePage({
    pageGuid: page.guid,
    properties: { state: { type: 'string', value: input.state } },
    ...(tagsChanged ? { tags } : {}),
  });
  if (input.comment?.trim()) await deps.addComment(page.guid, input.comment);

  const out = [line({ type, state: input.state, title: page.title, guid: page.guid, tags })];
  if (input.state !== 'Done' || type === INITIATIVE) return out.join('\n');

  let parentGuid = page.folderId;
  while (parentGuid) {
    const parent = await deps.loadPage(parentGuid);
    const parentType = parent.pageType ? types.byGuid.get(parent.pageType) : undefined;
    if (!parentType || stateOf(parent) === 'Done') break;

    const siblings = await ticketChildren(deps, types, parent.guid);
    if (!siblings.every(s => stateOf(s) === 'Done')) break;

    const summary = `${parentType.name} · ${parent.title} · ${parent.guid}`;
    if (!input.rollup || parentType.name === INITIATIVE) {
      out.push(`closeable: ${summary}`);
      break;
    }
    await setStateOn(deps, parent.guid, 'Done');
    await deps.addComment(parent.guid, 'Auto-closed: all children Done');
    out.push(`closed: ${summary}`);
    parentGuid = parent.folderId;
  }
  return out.join('\n');
}
