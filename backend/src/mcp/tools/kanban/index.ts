/**
 * MCP registration for the kanban tools: schemas + dispatch.
 * Descriptions are deliberately short — the tool list is sent to every client session.
 */

import { defaultKanbanDeps } from './deps.js';
import {
  CreateNode,
  STATES,
  kanbanBoard,
  kanbanCreate,
  kanbanGet,
  kanbanInitiatives,
  kanbanNext,
  kanbanSetState,
} from './kanban.js';

const STATE_LIST = STATES.join('|');
const guid = (description: string) => ({ type: 'string', description });

export const KANBAN_TOOLS = [
  {
    name: 'kanban_initiatives',
    description: 'Kanban: list Initiatives (one per feature board) as "guid · title · state · N open". Done ones hidden unless includeDone.',
    inputSchema: {
      type: 'object' as const,
      properties: { includeDone: { type: 'boolean', description: 'Also list Done initiatives' } },
    },
  },
  {
    name: 'kanban_next',
    description: `Kanban: next ticket to work on in an initiative — first In Progress leaf, else first Ready leaf, in tree order, skipping Blocked/Done subtrees. Returns a ticket card. claim=true sets it (and Ready ancestors) to In Progress. States: ${STATE_LIST}.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        initiative: guid('Initiative page GUID'),
        claim: { type: 'boolean', description: 'Move the ticket to In Progress' },
      },
      required: ['initiative'],
    },
  },
  {
    name: 'kanban_get',
    description: 'Kanban: ticket card for one ticket — header, ancestor path, body, last 5 comments.',
    inputSchema: {
      type: 'object' as const,
      properties: { guid: guid('Ticket page GUID') },
      required: ['guid'],
    },
  },
  {
    name: 'kanban_board',
    description: 'Kanban: indented tree of an initiative, one line per ticket "Type · State · Title · guid[ · #tags]".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        initiative: guid('Initiative page GUID'),
        states: { type: 'array', items: { type: 'string' }, description: 'Only show these states (plus their ancestors)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Only show tickets with any of these tags (plus their ancestors); combines with states' },
        depth: { type: 'number', description: 'Levels below the initiative to show' },
      },
      required: ['initiative'],
    },
  },
  {
    name: 'kanban_create',
    description: 'Kanban: create a nested ticket tree under a parent ticket in one call. Node: {type (Epic|Story|Task…), title, body?, state? (default Ready), tags? (string[]), children?}. Validates everything before writing. Returns created "Type · Title · guid" lines.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        parentGuid: guid('Parent ticket GUID (e.g. the initiative)'),
        tree: {
          type: ['object', 'array'],
          description: 'One node or an array of sibling nodes',
        },
      },
      required: ['parentGuid', 'tree'],
    },
  },
  {
    name: 'kanban_set_state',
    description: `Kanban: set a ticket's state (${STATE_LIST}), optionally adding a comment and adding/removing tags (merged with existing). On Done, reports a parent whose children are now all Done ("closeable"); rollup=true closes that chain upward instead (never the Initiative).`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        guid: guid('Ticket page GUID'),
        state: { type: 'string', enum: [...STATES] },
        comment: { type: 'string', description: 'Comment to add, e.g. "commit abc123 — what changed"' },
        rollup: { type: 'boolean', description: 'Auto-close completed parents' },
        addTags: { type: 'array', items: { type: 'string' }, description: 'Tags to add, e.g. ["dean"]' },
        removeTags: { type: 'array', items: { type: 'string' }, description: 'Tags to remove' },
      },
      required: ['guid', 'state'],
    },
  },
];

type Args = Record<string, unknown>;

/** Run a kanban tool; returns undefined when the name isn't a kanban tool. */
export async function callKanbanTool(name: string, args: Args): Promise<string | undefined> {
  if (!name.startsWith('kanban_')) return undefined;
  const deps = defaultKanbanDeps();
  switch (name) {
    case 'kanban_initiatives':
      return kanbanInitiatives(deps, args as { includeDone?: boolean });
    case 'kanban_next':
      return kanbanNext(deps, args as { initiative: string; claim?: boolean });
    case 'kanban_get':
      return kanbanGet(deps, args as { guid: string });
    case 'kanban_board':
      return kanbanBoard(deps, args as { initiative: string; states?: string[]; tags?: string[]; depth?: number });
    case 'kanban_create':
      return kanbanCreate(deps, args as { parentGuid: string; tree: CreateNode | CreateNode[] });
    case 'kanban_set_state':
      return kanbanSetState(deps, args as {
        guid: string; state: string; comment?: string; rollup?: boolean; addTags?: string[]; removeTags?: string[];
      });
    default:
      return undefined;
  }
}
