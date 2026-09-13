import { boardableTypes } from './boardable-types';
import type { PageTypeDefinition } from '../pages/page.types';

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt-1',
    name: 'Task',
    icon: '✅',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: false,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

describe('boardableTypes', () => {
  it('returns only the type(s) whose schema defines a state property', () => {
    const stateBearing = pageType({
      guid: 'pt-task',
      name: 'Task',
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const plainA = pageType({
      guid: 'pt-note',
      name: 'Note',
      properties: [{ name: 'title', type: 'string', required: false }],
    });
    const plainB = pageType({ guid: 'pt-doc', name: 'Doc', properties: [] });

    expect(boardableTypes([plainA, stateBearing, plainB])).toEqual([stateBearing]);
  });

  it('preserves input order and returns every state-bearing type', () => {
    const a = pageType({ guid: 'a', properties: [{ name: 'state', type: 'string', required: false }] });
    const b = pageType({ guid: 'b', properties: [{ name: 'title', type: 'string', required: false }] });
    const c = pageType({ guid: 'c', properties: [{ name: 'state', type: 'string', required: false }] });

    expect(boardableTypes([a, b, c])).toEqual([a, c]);
  });

  it('returns an empty array when no page type defines a state property', () => {
    const plain = pageType({ guid: 'pt-note', properties: [{ name: 'title', type: 'string', required: false }] });
    expect(boardableTypes([plain])).toEqual([]);
  });

  it('returns an empty array for an empty input', () => {
    expect(boardableTypes([])).toEqual([]);
  });
});
