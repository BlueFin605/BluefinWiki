import { TestBed } from '@angular/core/testing';
import { Drafts, type PageDraft } from './drafts';

describe('Drafts service', () => {
  let drafts: Drafts;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [Drafts] });
    drafts = TestBed.inject(Drafts);
  });

  function makeDraft(content: string, title = 'Title'): PageDraft {
    return {
      content,
      metadata: {
        title,
        tags: [],
        status: 'draft',
        createdBy: 'u',
        modifiedBy: 'u',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
        guid: 'g',
      },
    };
  }

  it('returns undefined for unknown guid', () => {
    expect(drafts.get('missing')).toBeUndefined();
  });

  it('round-trips a draft via localStorage', () => {
    drafts.set('g1', makeDraft('hello'));
    // Force a re-read by spinning up a new instance with a clean memory cache.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Drafts] });
    const fresh = TestBed.inject(Drafts);
    expect(fresh.get('g1')?.content).toBe('hello');
  });

  it('serves repeat reads from the memory cache', () => {
    drafts.set('g2', makeDraft('cached'));
    const spy = jest.spyOn(Storage.prototype, 'getItem');
    expect(drafts.get('g2')?.content).toBe('cached');
    expect(spy).not.toHaveBeenCalledWith('bluefinwiki:draft:g2');
    spy.mockRestore();
  });

  it('clear() removes both the memory entry and the localStorage row', () => {
    drafts.set('g3', makeDraft('bye'));
    drafts.clear('g3');
    expect(drafts.get('g3')).toBeUndefined();
    expect(localStorage.getItem('bluefinwiki:draft:g3')).toBeNull();
  });

  it('hasDraft() reports true only after a set', () => {
    expect(drafts.hasDraft('g4')).toBe(false);
    drafts.set('g4', makeDraft('x'));
    expect(drafts.hasDraft('g4')).toBe(true);
    drafts.clear('g4');
    expect(drafts.hasDraft('g4')).toBe(false);
  });

  it('survives a malformed JSON entry without throwing', () => {
    localStorage.setItem('bluefinwiki:draft:g5', '{not json');
    expect(() => drafts.get('g5')).not.toThrow();
    expect(drafts.get('g5')).toBeUndefined();
  });

  it('isolates keys per guid', () => {
    drafts.set('a', makeDraft('A', 'Title A'));
    drafts.set('b', makeDraft('B', 'Title B'));
    expect(drafts.get('a')?.content).toBe('A');
    expect(drafts.get('b')?.content).toBe('B');
  });
});
