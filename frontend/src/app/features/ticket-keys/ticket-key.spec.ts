import { KEY_PREFIX_PATTERN, isTicketKey } from './ticket-key';

describe('ticket-key patterns', () => {
  it('isTicketKey accepts keys, trimmed and any case', () => {
    expect(isTicketKey('BGT-1')).toBe(true);
    expect(isTicketKey(' bgt-12 ')).toBe(true);
  });

  it('isTicketKey rejects non-keys', () => {
    expect(isTicketKey('3f2b8c1e-5d4a-4b6e-9c7d-1a2b3c4d5e6f')).toBe(false);
    expect(isTicketKey('BGT')).toBe(false);
    expect(isTicketKey('BGT-')).toBe(false);
    expect(isTicketKey('1A-2')).toBe(false);
  });

  it('KEY_PREFIX_PATTERN accepts valid prefixes', () => {
    expect(KEY_PREFIX_PATTERN.test('BGT')).toBe(true);
    expect(KEY_PREFIX_PATTERN.test('B2')).toBe(true);
  });

  it('KEY_PREFIX_PATTERN rejects invalid prefixes', () => {
    expect(KEY_PREFIX_PATTERN.test('bgt')).toBe(false);
    expect(KEY_PREFIX_PATTERN.test('B')).toBe(false);
    expect(KEY_PREFIX_PATTERN.test('ABCDEFGHIJK')).toBe(false);
  });
});
