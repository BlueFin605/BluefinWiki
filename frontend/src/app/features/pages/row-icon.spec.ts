import { rowIcon, FOLDER_ICON, DOCUMENT_ICON } from './row-icon';
import type { PageSummary, PageTypeDefinition } from './page.types';

function summary(over: Partial<PageSummary> = {}): PageSummary {
  return {
    guid: 'g',
    title: 'Title',
    parentGuid: null,
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt',
    name: 'Recipe',
    icon: '🍳',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: true,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('rowIcon', () => {
  it('returns the page-type icon when the page is typed and the type is in the map', () => {
    const map = { recipe: pageType({ icon: '🍳' }) };
    expect(rowIcon(summary({ pageType: 'recipe' }), map)).toBe('🍳');
  });

  it('a typed page-type icon wins even when the page also has children', () => {
    const map = { recipe: pageType({ icon: '🍳' }) };
    expect(rowIcon(summary({ pageType: 'recipe', hasChildren: true }), map)).toBe('🍳');
  });

  it('returns the folder icon for an untyped page with children', () => {
    expect(rowIcon(summary({ hasChildren: true }), {})).toBe(FOLDER_ICON);
    expect(FOLDER_ICON).toBe('📁');
  });

  it('returns the document icon for an untyped leaf', () => {
    expect(rowIcon(summary({ hasChildren: false }), {})).toBe(DOCUMENT_ICON);
    expect(DOCUMENT_ICON).toBe('📄');
  });

  it('falls through to folder/doc when the page-type is not in the map', () => {
    expect(rowIcon(summary({ pageType: 'ghost', hasChildren: true }), {})).toBe(FOLDER_ICON);
    expect(rowIcon(summary({ pageType: 'ghost', hasChildren: false }), {})).toBe(DOCUMENT_ICON);
  });

  it('falls through to folder/doc when the matched type has a blank icon', () => {
    const map = { recipe: pageType({ icon: '' }) };
    expect(rowIcon(summary({ pageType: 'recipe', hasChildren: true }), map)).toBe(FOLDER_ICON);
    expect(rowIcon(summary({ pageType: 'recipe', hasChildren: false }), map)).toBe(DOCUMENT_ICON);
  });
});
