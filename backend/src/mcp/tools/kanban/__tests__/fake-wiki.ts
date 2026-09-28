/**
 * In-memory wiki implementing KanbanDeps, for kanban tool unit tests.
 * Pages are stored flat; parent/child is folderId, sibling order is sortOrder.
 */

import type { Comment, PageContent, PageSummary } from '../../../../types/index.js';
import type { KanbanDeps, KanbanPageType } from '../deps.js';

export const TYPES: KanbanPageType[] = [
  { guid: 't-init', name: 'Initiative', propertyNames: ['state'], allowedChildTypes: ['t-epic'] },
  { guid: 't-epic', name: 'Epic', propertyNames: ['state'], allowedChildTypes: ['t-story'] },
  { guid: 't-story', name: 'Story', propertyNames: ['state'], allowedChildTypes: ['t-task'] },
  { guid: 't-task', name: 'Task', propertyNames: ['state'], allowedChildTypes: [] },
  { guid: 't-note', name: 'Note', propertyNames: [], allowedChildTypes: [] },
];

const TYPE_BY_NAME = Object.fromEntries(TYPES.map(t => [t.name, t.guid]));

export interface FakeWiki extends KanbanDeps {
  pages: Map<string, PageContent>;
  comments: Map<string, Comment[]>;
  /** Add a page; type is a type name, state omitted for untyped pages. */
  add(guid: string, parent: string | null, type: string | null, state?: string, title?: string): void;
  stateOf(guid: string): string | undefined;
  failCreateAfter?: number;
}

export function createFakeWiki(): FakeWiki {
  const pages = new Map<string, PageContent>();
  const comments = new Map<string, Comment[]>();
  let order = 0;
  let nextId = 0;

  const toSummary = (p: PageContent): PageSummary => ({
    guid: p.guid,
    title: p.title,
    parentGuid: p.folderId || null,
    status: p.status === 'deleted' ? 'archived' : p.status,
    sortOrder: p.sortOrder,
    createdBy: p.createdBy,
    modifiedAt: p.modifiedAt,
    modifiedBy: p.modifiedBy,
    hasChildren: [...pages.values()].some(c => c.folderId === p.guid),
    ...(p.pageType ? { pageType: p.pageType } : {}),
    ...(p.properties ? { properties: p.properties } : {}),
  });

  const wiki: FakeWiki = {
    pages,
    comments,

    add(guid, parent, type, state, title) {
      pages.set(guid, {
        guid,
        title: title ?? guid,
        content: `body of ${guid}`,
        folderId: parent ?? '',
        tags: [],
        status: 'published',
        sortOrder: (order += 1000),
        ...(type ? { pageType: TYPE_BY_NAME[type] } : {}),
        ...(state ? { properties: { state: { type: 'string', value: state } } } : {}),
        createdBy: 'u', modifiedBy: 'u', createdAt: '', modifiedAt: '',
      } as PageContent);
    },

    stateOf(guid) {
      return pages.get(guid)?.properties?.state?.value as string | undefined;
    },

    async listChildren(parentGuid) {
      return [...pages.values()]
        .filter(p => (p.folderId || null) === parentGuid)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(toSummary);
    },

    async loadPage(guid) {
      const p = pages.get(guid);
      if (!p) throw Object.assign(new Error('Page not found'), { code: 'PAGE_NOT_FOUND' });
      return p;
    },

    async listPageTypes() {
      return TYPES;
    },

    async createPage(input) {
      if (wiki.failCreateAfter !== undefined && nextId >= wiki.failCreateAfter) {
        throw new Error('S3 exploded');
      }
      const guid = `new-${++nextId}`;
      const type = TYPES.find(t => t.guid === input.pageType);
      wiki.add(guid, input.parentGuid ?? null, type?.name ?? null, input.properties?.state?.value as string, input.title);
      pages.get(guid)!.content = input.content ?? '';
      return { guid };
    },

    async updatePage(input) {
      const p = pages.get(input.pageGuid)!;
      p.properties = { ...(p.properties || {}) };
      for (const [k, v] of Object.entries(input.properties || {})) {
        if (v === null) delete p.properties[k];
        else p.properties[k] = v;
      }
    },

    async addComment(pageGuid, body) {
      const list = comments.get(pageGuid) || [];
      list.push({
        id: `c${list.length}`, parentId: null, authorId: 'mcp-client', authorName: 'MCP Client',
        body, createdAt: `2026-01-0${list.length + 1}T00:00:00Z`, editedAt: null, deletedAt: null,
      });
      comments.set(pageGuid, list);
    },

    async listComments(pageGuid) {
      return comments.get(pageGuid) || [];
    },
  };

  return wiki;
}
