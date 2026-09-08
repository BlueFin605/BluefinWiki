import { TestBed } from '@angular/core/testing';
import {
  InvalidationBus,
  pageTag,
  childrenTag,
  childrenAnyTag,
  ancestorsTag,
  backlinksTag,
  pageTypesListTag,
  pageTypeTag,
  allowedChildrenTag,
  attachmentsTag,
  usersListTag,
  invitationsListTag,
} from './invalidation';

describe('InvalidationBus', () => {
  let bus: InvalidationBus;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InvalidationBus] });
    bus = TestBed.inject(InvalidationBus);
  });

  it('version() of an unseen tag is a stable number (0)', () => {
    expect(bus.version('never-seen')).toBe(0);
    expect(bus.version('never-seen')).toBe(0);
  });

  it('bump(tag) increments only that tag version', () => {
    const before = bus.version('a');
    const otherBefore = bus.version('b');

    bus.bump('a');

    expect(bus.version('a')).toBe(before + 1);
    expect(bus.version('b')).toBe(otherBefore);
  });

  it('bump(tag) is repeatable and monotonic', () => {
    bus.bump('x');
    bus.bump('x');
    bus.bump('x');
    expect(bus.version('x')).toBe(3);
  });

  it('bumpMany(tags) bumps each listed tag once and nothing else', () => {
    bus.bumpMany(['p', 'q']);
    expect(bus.version('p')).toBe(1);
    expect(bus.version('q')).toBe(1);
    expect(bus.version('r')).toBe(0);
  });

  it('version() reads as a signal so callers re-run when the tag bumps', () => {
    // Reading inside a computed/effect-like closure: just assert the value moves.
    const read = () => bus.version('sig');
    expect(read()).toBe(0);
    bus.bump('sig');
    expect(read()).toBe(1);
  });
});

describe('tag helpers', () => {
  it('pageTag', () => expect(pageTag('g1')).toBe('page:g1'));
  it('childrenTag with a guid', () => expect(childrenTag('p1')).toBe('children:p1'));
  it('childrenTag with null → root', () => expect(childrenTag(null)).toBe('children:root'));
  it('childrenAnyTag', () => expect(childrenAnyTag()).toBe('children:any'));
  it('ancestorsTag', () => expect(ancestorsTag('g1')).toBe('ancestors:g1'));
  it('backlinksTag', () => expect(backlinksTag('g1')).toBe('backlinks:g1'));
  it('pageTypesListTag', () => expect(pageTypesListTag()).toBe('page-types:list'));
  it('pageTypeTag', () => expect(pageTypeTag('pt1')).toBe('page-type:pt1'));
  it('allowedChildrenTag', () =>
    expect(allowedChildrenTag('pt1')).toBe('page-type:allowed-children:pt1'));
  it('attachmentsTag', () => expect(attachmentsTag('p1')).toBe('attachments:p1'));
  it('usersListTag', () => expect(usersListTag()).toBe('users:list'));
  it('invitationsListTag', () => expect(invitationsListTag()).toBe('invitations:list'));
});
