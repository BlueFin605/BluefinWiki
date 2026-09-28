/**
 * Everything the kanban tools need from the wiki, behind one interface so the
 * tools can be unit-tested against an in-memory wiki (see __tests__/fake-wiki.ts).
 */

import { getStoragePlugin } from '../../../storage/StoragePluginRegistry.js';
import { listComments, addComment } from '../../../pages/comments-service.js';
import { Comment, PageContent, PageSummary } from '../../../types/index.js';
import { listPageTypes } from '../../../page-types/page-types-service.js';
import { createPage, CreatePageInput } from '../create-page.js';
import { updatePage, UpdatePageInput } from '../update-page.js';

export interface KanbanPageType {
  guid: string;
  name: string;
  propertyNames: string[];
  allowedChildTypes: string[];
}

export interface KanbanDeps {
  listChildren(parentGuid: string | null): Promise<PageSummary[]>;
  loadPage(guid: string): Promise<PageContent>;
  listPageTypes(): Promise<KanbanPageType[]>;
  createPage(input: CreatePageInput): Promise<{ guid: string }>;
  updatePage(input: UpdatePageInput): Promise<unknown>;
  addComment(pageGuid: string, body: string): Promise<unknown>;
  listComments(pageGuid: string): Promise<Comment[]>;
}

export function defaultKanbanDeps(): KanbanDeps {
  const storage = getStoragePlugin();
  return {
    listChildren: (parentGuid) => storage.listChildren(parentGuid),
    loadPage: (guid) => storage.loadPage(guid),
    listPageTypes: async () => (await listPageTypes()).map(t => ({
      guid: t.guid,
      name: t.name,
      propertyNames: t.properties.map(p => p.name),
      allowedChildTypes: t.allowedChildTypes,
    })),
    createPage,
    updatePage,
    addComment: (pageGuid, body) =>
      addComment(pageGuid, { body, parentId: null }, { authorId: 'mcp-client', authorName: 'MCP Client' }),
    listComments,
  };
}
