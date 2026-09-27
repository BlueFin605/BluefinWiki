import { isBoardEligible } from './is-board-eligible';
import type { PageChildDetail, PageTypeDefinition } from '../pages/page.types';

function child(over: Partial<PageChildDetail> = {}): PageChildDetail {
  return {
    guid: 'c1',
    title: 'Child',
    parentGuid: 'p1',
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt-task',
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

const STATE_BEARING_TYPE = pageType({
  guid: 'pt-task',
  properties: [{ name: 'state', type: 'string', required: false }],
});
const PLAIN_TYPE = pageType({ guid: 'pt-plain', properties: [] });

describe('isBoardEligible', () => {
  it('is eligible when boardConfig.targetTypeGuid is set, regardless of children', () => {
    expect(isBoardEligible({ boardConfig: { targetTypeGuid: 'pt-task' } }, [], {})).toBe(true);
  });

  it('is eligible when a direct child of a state-bearing type has a value', () => {
    const children = [
      child({ pageType: 'pt-task', properties: { state: { type: 'string', value: 'To Do' } } }),
    ];
    const pageTypesMap = { 'pt-task': STATE_BEARING_TYPE };
    expect(isBoardEligible(null, children, pageTypesMap)).toBe(true);
  });

  it('is not eligible when children are of a state-bearing type but all values are empty', () => {
    const children = [
      child({ guid: 'a', pageType: 'pt-task', properties: { state: { type: 'string', value: '' } } }),
      child({ guid: 'b', pageType: 'pt-task' }), // no properties at all
    ];
    const pageTypesMap = { 'pt-task': STATE_BEARING_TYPE };
    expect(isBoardEligible(null, children, pageTypesMap)).toBe(false);
  });

  it('is not eligible with no boardConfig and no state-bearing children', () => {
    const children = [child({ pageType: 'pt-plain' })];
    const pageTypesMap = { 'pt-plain': PLAIN_TYPE };
    expect(isBoardEligible(undefined, children, pageTypesMap)).toBe(false);
  });

  it('is not eligible when there are no children at all', () => {
    expect(isBoardEligible(null, [], {})).toBe(false);
  });

  it('ignores a boardConfig that has no targetTypeGuid', () => {
    const children = [child({ pageType: 'pt-plain' })];
    const pageTypesMap = { 'pt-plain': PLAIN_TYPE };
    expect(
      isBoardEligible({ boardConfig: { columns: ['Alpha'] } }, children, pageTypesMap),
    ).toBe(false);
  });

  it('is not eligible when a child references a page type missing from the map', () => {
    const children = [
      child({ pageType: 'unknown-type', properties: { state: { type: 'string', value: 'x' } } }),
    ];
    expect(isBoardEligible(null, children, {})).toBe(false);
  });

  it('is not eligible when a child has no pageType at all', () => {
    const children = [child({ properties: { state: { type: 'string', value: 'x' } } })];
    expect(isBoardEligible(null, children, {})).toBe(false);
  });
});
