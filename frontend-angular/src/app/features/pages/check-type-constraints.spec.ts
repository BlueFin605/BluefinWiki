import { checkTypeConstraints } from './check-type-constraints';
import type { PageSummary, PageTypeDefinition } from './page.types';

function s(over: Partial<PageSummary>): PageSummary {
  return {
    guid: 'g', title: 'T', parentGuid: null, status: 'published',
    modifiedAt: '2026-01-01', modifiedBy: 'u', hasChildren: false,
    ...over,
  };
}

function typeDef(over: Partial<PageTypeDefinition>): PageTypeDefinition {
  return {
    guid: 'guid', name: 'Name', icon: '📦', properties: [],
    allowedChildTypes: [], allowWikiPageChildren: true,
    allowedParentTypes: [], allowAnyParent: true,
    createdBy: 'u', createdAt: '', updatedAt: '',
    ...over,
  };
}

describe('checkTypeConstraints', () => {
  it('returns [] when no types are involved', () => {
    expect(checkTypeConstraints(s({ guid: 'a' }), s({ guid: 'b' }), {})).toEqual([]);
  });

  it('rejects a child type the parent does not allow', () => {
    const map = {
      parent: typeDef({ guid: 'parent', name: 'Folder', allowedChildTypes: ['recipe'] }),
      tv: typeDef({ guid: 'tv', name: 'TVShow' }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd', pageType: 'tv' }),
      s({ guid: 't', pageType: 'parent' }),
      map,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Folder does not allow TVShow/i);
  });

  it('allows any child when parent.allowedChildTypes is empty', () => {
    const map = {
      parent: typeDef({ guid: 'parent', name: 'OpenFolder', allowedChildTypes: [], allowWikiPageChildren: true }),
    };
    expect(
      checkTypeConstraints(
        s({ guid: 'd' }),
        s({ guid: 't', pageType: 'parent' }),
        map,
      ),
    ).toEqual([]);
  });

  it('rejects untyped child when parent disallows wiki pages', () => {
    const map = {
      parent: typeDef({ guid: 'parent', name: 'Strict', allowedChildTypes: [], allowWikiPageChildren: false }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd' }),
      s({ guid: 't', pageType: 'parent' }),
      map,
    );
    expect(warnings[0]).toMatch(/Strict does not allow untyped/i);
  });

  it('rejects when child restricts allowed parent types and parent does not match', () => {
    const map = {
      recipe: typeDef({ guid: 'recipe', name: 'Recipe', allowedParentTypes: ['cookbook'] }),
      parent: typeDef({ guid: 'parent', name: 'Folder' }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd', pageType: 'recipe' }),
      s({ guid: 't', pageType: 'parent' }),
      map,
    );
    expect(warnings[0]).toMatch(/Recipe cannot be placed under Folder/i);
  });

  it('rejects child placed under untyped parent when child requires typed parent', () => {
    const map = {
      recipe: typeDef({ guid: 'recipe', name: 'Recipe', allowedParentTypes: ['cookbook'], allowAnyParent: false }),
    };
    const warnings = checkTypeConstraints(
      s({ guid: 'd', pageType: 'recipe' }),
      s({ guid: 't' }), // untyped target
      map,
    );
    expect(warnings[0]).toMatch(/Recipe cannot be placed under an untyped/i);
  });

  it('allows when both checks pass', () => {
    const map = {
      cookbook: typeDef({ guid: 'cookbook', name: 'Cookbook', allowedChildTypes: ['recipe'] }),
      recipe: typeDef({ guid: 'recipe', name: 'Recipe', allowedParentTypes: ['cookbook'] }),
    };
    expect(
      checkTypeConstraints(
        s({ guid: 'd', pageType: 'recipe' }),
        s({ guid: 't', pageType: 'cookbook' }),
        map,
      ),
    ).toEqual([]);
  });
});
