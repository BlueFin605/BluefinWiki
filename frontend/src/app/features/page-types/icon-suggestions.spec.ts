import { GENERIC_ICONS, ICON_SUGGESTIONS, isGenericIcon } from './icon-suggestions';
import { DOCUMENT_ICON, FOLDER_ICON } from '../pages/row-icon';

describe('icon-suggestions', () => {
  it('treats the untyped page and folder icons as generic', () => {
    expect(GENERIC_ICONS).toEqual([DOCUMENT_ICON, FOLDER_ICON]);
    expect(isGenericIcon('📄')).toBe(true);
    expect(isGenericIcon('📁')).toBe(true);
    expect(isGenericIcon(' 📄 ')).toBe(true);
  });

  it('does not flag a distinct icon or an empty one', () => {
    expect(isGenericIcon('✅')).toBe(false);
    expect(isGenericIcon('')).toBe(false);
  });

  it('never suggests a generic icon and has no duplicates', () => {
    expect(ICON_SUGGESTIONS.some(isGenericIcon)).toBe(false);
    expect(new Set(ICON_SUGGESTIONS).size).toBe(ICON_SUGGESTIONS.length);
  });
});
