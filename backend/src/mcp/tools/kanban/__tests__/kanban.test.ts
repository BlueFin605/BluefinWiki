/**
 * Unit tests for the kanban MCP tools against an in-memory wiki.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeWiki, FakeWiki } from './fake-wiki.js';
import {
  kanbanInitiatives,
  kanbanNext,
  kanbanGet,
  kanbanBoard,
  kanbanCreate,
  kanbanSetState,
} from '../kanban.js';

/**
 * init
 * ├── epicA (In Progress)
 * │   ├── story1 (In Progress)
 * │   │   ├── task1 (Done)
 * │   │   └── task2 (Ready)
 * │   └── story2 (Ready)
 * │       └── task3 (Ready)
 * └── epicB (Ready)
 *     └── task4 (Ready)
 */
function seed(wiki: FakeWiki) {
  wiki.add('init', null, 'Initiative', 'In Progress', 'Home');
  wiki.add('epicA', 'init', 'Epic', 'In Progress', 'Epic A');
  wiki.add('story1', 'epicA', 'Story', 'In Progress', 'Story 1');
  wiki.add('task1', 'story1', 'Task', 'Done', 'Task 1');
  wiki.add('task2', 'story1', 'Task', 'Ready', 'Task 2');
  wiki.add('story2', 'epicA', 'Story', 'Ready', 'Story 2');
  wiki.add('task3', 'story2', 'Task', 'Ready', 'Task 3');
  wiki.add('epicB', 'init', 'Epic', 'Ready', 'Epic B');
  wiki.add('task4', 'epicB', 'Task', 'Ready', 'Task 4');
}

let wiki: FakeWiki;

beforeEach(() => {
  wiki = createFakeWiki();
  seed(wiki);
});

describe('kanbanNext', () => {
  it('returns the first Ready leaf in tree order', async () => {
    const out = await kanbanNext(wiki, { initiative: 'init' });
    expect(out.split('\n')[0]).toBe('Task · Ready · Task 2 · task2');
  });

  it('resumes an In Progress leaf before picking a Ready one', async () => {
    wiki.add('task5', 'story2', 'Task', 'In Progress', 'Task 5');
    const out = await kanbanNext(wiki, { initiative: 'init' });
    expect(out.split('\n')[0]).toBe('Task · In Progress · Task 5 · task5');
  });

  it('skips leaves under Blocked or Done ancestors and Backlog leaves', async () => {
    await wiki.updatePage({ pageGuid: 'story1', properties: { state: { type: 'string', value: 'Blocked' } } });
    await wiki.updatePage({ pageGuid: 'story2', properties: { state: { type: 'string', value: 'Done' } } });
    await wiki.updatePage({ pageGuid: 'task4', properties: { state: { type: 'string', value: 'Backlog' } } });
    wiki.add('task6', 'epicB', 'Task', 'Ready', 'Task 6');
    const out = await kanbanNext(wiki, { initiative: 'init' });
    expect(out.split('\n')[0]).toBe('Task · Ready · Task 6 · task6');
  });

  it('treats a ticket whose only children are untyped pages as a leaf', async () => {
    wiki.add('note', 'task2', 'Note', undefined, 'Some notes');
    const out = await kanbanNext(wiki, { initiative: 'init' });
    expect(out.split('\n')[0]).toBe('Task · Ready · Task 2 · task2');
  });

  it('claim moves the leaf and its Ready ancestors to In Progress, leaving the initiative alone', async () => {
    await wiki.updatePage({ pageGuid: 'task2', properties: { state: { type: 'string', value: 'Done' } } });
    await wiki.updatePage({ pageGuid: 'init', properties: { state: { type: 'string', value: 'Ready' } } });
    const out = await kanbanNext(wiki, { initiative: 'init', claim: true });
    expect(out.split('\n')[0]).toBe('Task · In Progress · Task 3 · task3');
    expect(wiki.stateOf('task3')).toBe('In Progress');
    expect(wiki.stateOf('story2')).toBe('In Progress');
    expect(wiki.stateOf('init')).toBe('Ready');
  });

  it('errors with state counts when nothing is pickable', async () => {
    for (const g of ['task2', 'task3', 'task4']) {
      await wiki.updatePage({ pageGuid: g, properties: { state: { type: 'string', value: 'Blocked' } } });
    }
    await expect(kanbanNext(wiki, { initiative: 'init' }))
      .rejects.toThrow('initiative has no Ready leaves (3 Blocked, 1 Done)');
  });

  it('rejects a non-initiative root', async () => {
    await expect(kanbanNext(wiki, { initiative: 'epicA' })).rejects.toThrow('not an Initiative: Epic A');
  });
});

describe('kanbanGet', () => {
  it('renders a card with path, body and the last 5 comments', async () => {
    for (let i = 1; i <= 7; i++) await wiki.addComment('task2', `note ${i}`);
    const out = await kanbanGet(wiki, { guid: 'task2' });
    const lines = out.split('\n');
    expect(lines[0]).toBe('Task · Ready · Task 2 · task2');
    expect(lines[1]).toBe('Path: Home › Epic A › Story 1');
    expect(out).toContain('body of task2');
    expect(out).toContain('-- comments (last 5 of 7) --');
    expect(out).not.toContain('note 2');
    expect(out).toContain('MCP Client: note 7');
  });

  it('omits the comments section when there are none', async () => {
    const out = await kanbanGet(wiki, { guid: 'task4' });
    expect(out).not.toContain('comments');
  });

  it('rejects a page that is not a ticket', async () => {
    wiki.add('note', 'task2', 'Note', undefined, 'Some notes');
    await expect(kanbanGet(wiki, { guid: 'note' })).rejects.toThrow('not a ticket: Some notes');
  });
});

describe('kanbanBoard', () => {
  it('renders an indented tree', async () => {
    const out = await kanbanBoard(wiki, { initiative: 'init' });
    expect(out.split('\n')).toEqual([
      'Initiative · In Progress · Home · init',
      '  Epic · In Progress · Epic A · epicA',
      '    Story · In Progress · Story 1 · story1',
      '      Task · Done · Task 1 · task1',
      '      Task · Ready · Task 2 · task2',
      '    Story · Ready · Story 2 · story2',
      '      Task · Ready · Task 3 · task3',
      '  Epic · Ready · Epic B · epicB',
      '    Task · Ready · Task 4 · task4',
    ]);
  });

  it('limits depth and filters by state, keeping ancestors of matches', async () => {
    const shallow = await kanbanBoard(wiki, { initiative: 'init', depth: 1 });
    expect(shallow.split('\n')).toHaveLength(3);

    const done = await kanbanBoard(wiki, { initiative: 'init', states: ['Done'] });
    expect(done.split('\n')).toEqual([
      'Initiative · In Progress · Home · init',
      '  Epic · In Progress · Epic A · epicA',
      '    Story · In Progress · Story 1 · story1',
      '      Task · Done · Task 1 · task1',
    ]);
  });
});

describe('kanbanCreate', () => {
  it('creates a nested tree with Ready as the default state', async () => {
    const out = await kanbanCreate(wiki, {
      parentGuid: 'init',
      tree: {
        type: 'Epic', title: 'Login', body: 'See docs/spec.md',
        children: [{ type: 'Story', title: 'Form', children: [{ type: 'Task', title: 'Button', state: 'Backlog' }] }],
      },
    });
    expect(out.split('\n')).toEqual([
      'Epic · Login · new-1',
      '  Story · Form · new-2',
      '    Task · Button · new-3',
    ]);
    expect(wiki.stateOf('new-1')).toBe('Ready');
    expect(wiki.stateOf('new-3')).toBe('Backlog');
    expect(wiki.pages.get('new-2')!.folderId).toBe('new-1');
    expect(wiki.pages.get('new-1')!.content).toBe('See docs/spec.md');
  });

  it('accepts an array of sibling nodes', async () => {
    const out = await kanbanCreate(wiki, {
      parentGuid: 'story2', tree: [{ type: 'Task', title: 'A' }, { type: 'Task', title: 'B' }],
    });
    expect(out.split('\n')).toHaveLength(2);
  });

  it.each([
    [{ type: 'Bogus', title: 'x' }, 'unknown ticket type "Bogus"'],
    [{ type: 'Epic', title: 'x', state: 'Doing' }, 'unknown state "Doing"; valid: Backlog|Ready|In Progress|Blocked|Done'],
    [{ type: 'Task', title: 'x' }, 'Task is not allowed under Initiative'],
    [{ type: 'Epic', title: '' }, 'title is required'],
  ])('validates the whole tree before writing anything (%o)', async (node, message) => {
    await expect(kanbanCreate(wiki, { parentGuid: 'init', tree: [{ type: 'Epic', title: 'ok' }, node] }))
      .rejects.toThrow(message);
    expect([...wiki.pages.keys()].filter(k => k.startsWith('new-'))).toEqual([]);
  });

  it('lists already-created guids when a write fails part way', async () => {
    wiki.failCreateAfter = 2;
    await expect(kanbanCreate(wiki, {
      parentGuid: 'init',
      tree: { type: 'Epic', title: 'E', children: [{ type: 'Story', title: 'S' }, { type: 'Story', title: 'T' }] },
    })).rejects.toThrow('create failed at "T": S3 exploded; already created: new-1, new-2');
  });
});

describe('kanbanSetState', () => {
  it('sets state, adds the comment, and reports the parent as closeable', async () => {
    const out = await kanbanSetState(wiki, { guid: 'task3', state: 'Done', comment: 'commit abc' });
    expect(out).toBe('Task · Done · Task 3 · task3\ncloseable: Story · Story 2 · story2');
    expect(wiki.stateOf('task3')).toBe('Done');
    expect((await wiki.listComments('task3'))[0].body).toBe('commit abc');
  });

  it('reports no closeable parent while a sibling is still open', async () => {
    wiki.add('task5', 'story2', 'Task', 'Ready', 'Task 5');
    const out = await kanbanSetState(wiki, { guid: 'task3', state: 'Done' });
    expect(out).toBe('Task · Done · Task 3 · task3');
  });

  it('rollup closes the chain upward but never closes the initiative', async () => {
    await kanbanSetState(wiki, { guid: 'task4', state: 'Done', rollup: true });
    await kanbanSetState(wiki, { guid: 'task2', state: 'Done', rollup: true });
    const out = await kanbanSetState(wiki, { guid: 'task3', state: 'Done', rollup: true });
    expect(out.split('\n')).toEqual([
      'Task · Done · Task 3 · task3',
      'closed: Story · Story 2 · story2',
      'closed: Epic · Epic A · epicA',
      'closeable: Initiative · Home · init',
    ]);
    expect(wiki.stateOf('epicA')).toBe('Done');
    expect(wiki.stateOf('init')).toBe('In Progress');
    expect((await wiki.listComments('story2'))[0].body).toBe('Auto-closed: all children Done');
  });

  it('rejects an unknown state', async () => {
    await expect(kanbanSetState(wiki, { guid: 'task3', state: 'Doing' }))
      .rejects.toThrow('unknown state "Doing"');
  });
});

describe('kanbanInitiatives', () => {
  it('lists initiatives with open ticket counts', async () => {
    wiki.add('other', null, null, undefined, 'Family');
    wiki.add('init2', 'other', 'Initiative', 'Ready', 'Nested');
    const out = await kanbanInitiatives(wiki);
    expect(out.split('\n')).toEqual([
      'init · Home · 7 open',
      'init2 · Nested · 0 open',
    ]);
  });
});
