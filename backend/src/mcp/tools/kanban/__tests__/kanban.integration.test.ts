/**
 * Integration test for the kanban tools against LocalStack (start Aspire first).
 * Uses the real storage plugin, page-type service, comments service and MCP
 * create/update tools. Creates its own page types and pages, and removes them.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

Object.assign(process.env, {
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_ENDPOINT_URL: 'http://localhost:4566',
  S3_PAGES_BUCKET: process.env.S3_PAGES_BUCKET || 'bluefinwiki-pages-local',
  DYNAMODB_COMMENTS_TABLE: process.env.DYNAMODB_COMMENTS_TABLE || 'bluefinwiki-comments-local',
  DYNAMODB_PAGE_INDEX_TABLE: process.env.DYNAMODB_PAGE_INDEX_TABLE || 'bluefinwiki-page-index-local',
  DYNAMODB_PAGE_LINKS_TABLE: process.env.DYNAMODB_PAGE_LINKS_TABLE || 'bluefinwiki-page-links-local',
});

const { createPageType, deletePageType } = await import('../../../../page-types/page-types-service.js');
const { initializeStoragePlugin, getStoragePlugin, resetStoragePlugin, StoragePluginRegistry } = await import('../../../../storage/index.js');
const { S3StoragePlugin } = await import('../../../../storage/S3StoragePlugin.js');
const { createPage } = await import('../../create-page.js');
const { defaultKanbanDeps } = await import('../deps.js');
const { kanbanCreate, kanbanNext, kanbanSetState, kanbanBoard } = await import('../kanban.js');

const typeGuids = { Initiative: uuidv4(), Epic: uuidv4(), Story: uuidv4(), Task: uuidv4() };
const children: Record<string, string[]> = {
  Initiative: [typeGuids.Epic],
  Epic: [typeGuids.Story],
  Story: [typeGuids.Task],
  Task: [],
};
let initiative: string;

describe('kanban tools (LocalStack)', () => {
  beforeAll(async () => {
    resetStoragePlugin();
    if (!StoragePluginRegistry.has('s3')) StoragePluginRegistry.register('s3', S3StoragePlugin as never);
    initializeStoragePlugin({
      type: 's3',
      bucketName: process.env.S3_PAGES_BUCKET!,
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
    });
    const now = new Date().toISOString();
    for (const [name, guid] of Object.entries(typeGuids)) {
      await createPageType({
        guid, name, icon: 'task',
        properties: [{ name: 'state', type: 'string', required: true }],
        allowedChildTypes: children[name],
        allowWikiPageChildren: true,
        allowedParentTypes: [],
        allowAnyParent: true,
        createdBy: 'kanban-test', createdAt: now, updatedAt: now,
      });
    }
    ({ guid: initiative } = await createPage({
      title: 'Kanban integration test',
      pageType: typeGuids.Initiative,
      properties: { state: { type: 'string', value: 'In Progress' } },
    }));
  });

  afterAll(async () => {
    if (initiative) await getStoragePlugin().deletePage(initiative, true);
    for (const guid of Object.values(typeGuids)) await deletePageType(guid);
    resetStoragePlugin();
  });

  it('creates a plan, works it leaf-first and rolls up to the initiative', async () => {
    const deps = defaultKanbanDeps();

    const created = await kanbanCreate(deps, {
      parentGuid: initiative,
      tree: {
        type: 'Epic', title: 'Feature', body: 'Spec: docs/spec.md',
        children: [{ type: 'Story', title: 'Slice', children: [
          { type: 'Task', title: 'First' },
          { type: 'Task', title: 'Second' },
        ] }],
      },
    });
    expect(created.split('\n')).toHaveLength(4);

    const first = await kanbanNext(deps, { initiative, claim: true });
    expect(first).toMatch(/^Task · In Progress · First · /);
    const firstGuid = first.split('\n')[0].split(' · ')[3];

    expect(await kanbanSetState(deps, { guid: firstGuid, state: 'Done', comment: 'commit abc' }))
      .toBe(`Task · Done · First · ${firstGuid}`);

    const second = await kanbanNext(deps, { initiative, claim: true });
    expect(second).toMatch(/^Task · In Progress · Second · /);
    const secondGuid = second.split('\n')[0].split(' · ')[3];

    const closed = await kanbanSetState(deps, { guid: secondGuid, state: 'Done', rollup: true });
    expect(closed.split('\n').slice(1)).toEqual([
      expect.stringMatching(/^closed: Story · Slice · /),
      expect.stringMatching(/^closed: Epic · Feature · /),
      expect.stringMatching(/^closeable: Initiative · Kanban integration test · /),
    ]);

    const board = await kanbanBoard(deps, { initiative, states: ['In Progress', 'Ready'] });
    expect(board.split('\n')).toHaveLength(1);
  });
});
