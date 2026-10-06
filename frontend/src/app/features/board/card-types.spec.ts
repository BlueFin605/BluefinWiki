import { configuredTypeGuids, hasCardTypeSelection, leafTypes, leafTypesLost, resolveCardTypes } from './card-types';
import type { PageTypeDefinition } from '../pages/page.types';

const STATE = [{ name: 'state', type: 'string' as const, required: true }];

function pt(guid: string, children: string[] = [], stateful = true): PageTypeDefinition {
  return {
    guid, name: guid, icon: 'x', properties: stateful ? STATE : [],
    allowedChildTypes: children, allowWikiPageChildren: false,
    allowedParentTypes: [], allowAnyParent: true, createdBy: 'u', createdAt: '', updatedAt: '',
  };
}

// Initiative > Epic > Story > Task|Bug ; TV Kanban (no state) > TV Show > Season ; Note (no state)
const TYPES = [
  pt('initiative', ['epic']), pt('epic', ['story']), pt('story', ['task', 'bug']),
  pt('task'), pt('bug'),
  pt('tv-kanban', ['tv-show'], false), pt('tv-show', ['season']), pt('season'),
  pt('note', [], false),
];

describe('card-types', () => {
  it('leafTypes: boardable types with no boardable child type, in input order', () => {
    expect(leafTypes(TYPES).map((t) => t.guid)).toEqual(['task', 'bug', 'season']);
  });

  it('leafTypes: a type whose only children are non-boardable is still a leaf', () => {
    expect(leafTypes([pt('a', ['note']), pt('note', [], false)]).map((t) => t.guid)).toEqual(['a']);
  });

  it('leafTypesLost: giving a leaf a boardable child type reports that leaf', () => {
    expect(leafTypesLost(TYPES, pt('task', ['bug'])).map((t) => t.guid)).toEqual(['task']);
  });

  it("leafTypesLost: adding state to a leaf's child type reports the parent leaf", () => {
    const types = [...TYPES.map((t) => (t.guid === 'task' ? pt('task', ['sub']) : t)), pt('sub', [], false)];
    expect(leafTypesLost(types, pt('sub')).map((t) => t.guid)).toEqual(['task']);
  });

  it('leafTypesLost: an edit that keeps every leaf reports nothing', () => {
    expect(leafTypesLost(TYPES, pt('story', ['task']))).toEqual([]);
  });

  it('leafTypesLost: a brand-new type (null guid) reports nothing unless it changes others', () => {
    expect(leafTypesLost(TYPES, { ...pt('new'), guid: null })).toEqual([]);
  });

  it('configuredTypeGuids reads targetTypeGuids, falling back to the legacy single guid', () => {
    expect(configuredTypeGuids({ targetTypeGuids: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(configuredTypeGuids({ targetTypeGuid: 'a' })).toEqual(['a']);
    expect(configuredTypeGuids({ targetTypeGuids: ['b'], targetTypeGuid: 'a' })).toEqual(['b']);
    expect(configuredTypeGuids({})).toEqual([]);
    expect(configuredTypeGuids(null)).toEqual([]);
  });

  it('hasCardTypeSelection is true for leaf mode or any configured type', () => {
    expect(hasCardTypeSelection({ leafTypes: true })).toBe(true);
    expect(hasCardTypeSelection({ targetTypeGuids: ['a'] })).toBe(true);
    expect(hasCardTypeSelection({ targetTypeGuid: 'a' })).toBe(true);
    expect(hasCardTypeSelection({ columns: ['x'] })).toBe(false);
    expect(hasCardTypeSelection(undefined)).toBe(false);
  });

  it('resolveCardTypes: leaf mode wins over targetTypeGuids', () => {
    expect(resolveCardTypes({ leafTypes: true, targetTypeGuids: ['story'] }, TYPES)).toEqual(['task', 'bug', 'season']);
    expect(resolveCardTypes({ targetTypeGuids: ['story'] }, TYPES)).toEqual(['story']);
    expect(resolveCardTypes({ leafTypes: true }, [])).toEqual([]);
    expect(resolveCardTypes(null, TYPES)).toEqual([]);
  });
});
