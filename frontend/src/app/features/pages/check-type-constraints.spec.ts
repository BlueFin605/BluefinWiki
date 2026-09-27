import { checkSiblingDropAllowed, checkTypeConstraints } from './check-type-constraints';
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

describe('checkSiblingDropAllowed', () => {
  const map = () => ({
    season: typeDef({ guid: 'season', name: 'Season', allowedChildTypes: ['episode'] }),
    episode: typeDef({ guid: 'episode', name: 'Episode', allowedParentTypes: ['season'] }),
    strict: typeDef({ guid: 'strict', name: 'Strict', allowWikiPageChildren: false }),
    rooted: typeDef({ guid: 'rooted', name: 'Rooted', allowedParentTypes: ['season'], allowAnyParent: false }),
    movie: typeDef({ guid: 'movie', name: 'Movie' }),
  });

  it('allows an Episode alongside its siblings under a Season (the parent, not the sibling row, is the target)', () => {
    expect(checkSiblingDropAllowed(s({ guid: 'e2', pageType: 'episode' }), 'season', map())).toEqual([]);
  });

  it('rejects a sibling drop the PARENT type does not allow as a child', () => {
    const warnings = checkSiblingDropAllowed(s({ guid: 'd', pageType: 'movie' }), 'season', map());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Season does not allow Movie as a child/i);
  });

  it('rejects a sibling drop under a parent the MOVING type does not accept', () => {
    const warnings = checkSiblingDropAllowed(s({ guid: 'd', pageType: 'episode' }), 'strict', map());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Episode cannot be placed under Strict/i);
  });

  it('rejects an untyped page under a parent that disallows untyped wiki children', () => {
    const warnings = checkSiblingDropAllowed(s({ guid: 'd' }), 'strict', map());
    expect(warnings[0]).toMatch(/Strict does not allow untyped wiki pages/i);
  });

  it('treats a null parent type (tree root / untyped parent) as an untyped target', () => {
    expect(checkSiblingDropAllowed(s({ guid: 'd', pageType: 'rooted' }), null, map())[0])
      .toMatch(/Rooted cannot be placed under an untyped/i);
  });

  it('allows a root-level drop when the moving type allows any parent', () => {
    expect(checkSiblingDropAllowed(s({ guid: 'd', pageType: 'episode' }), null, map())).toEqual([]);
  });

  it('ignores the moving page\'s OWN type rules about its children (it is not becoming a parent)', () => {
    // `season` only allows `episode` children; moving a Season next to its
    // siblings must not be judged against Season-as-parent.
    expect(checkSiblingDropAllowed(s({ guid: 's2', pageType: 'season' }), null, map())).toEqual([]);
  });
});
