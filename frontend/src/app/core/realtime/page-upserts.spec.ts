import { TestBed } from '@angular/core/testing';

import { PageUpserts, PageUpsertBatch } from './page-upserts';
import { PageUpsert } from '../../features/pages/page.types';

const page = (guid: string): PageUpsert => ({
  guid,
  title: guid,
  parentGuid: 'p',
  status: 'published',
  modifiedAt: 't',
  modifiedBy: 'u',
});

describe('PageUpserts', () => {
  it('delivers each emitted batch with its source to subscribers', () => {
    const upserts = TestBed.inject(PageUpserts);
    const seen: PageUpsertBatch[] = [];
    const sub = upserts.batches$.subscribe((b) => seen.push(b));
    upserts.emit([page('a'), page('b')], 'remote');
    upserts.emit([page('a')], 'local');
    sub.unsubscribe();

    expect(seen).toEqual([
      { pages: [page('a'), page('b')], source: 'remote' },
      { pages: [page('a')], source: 'local' },
    ]);
  });

  it('does not emit an empty batch', () => {
    const upserts = TestBed.inject(PageUpserts);
    const seen: PageUpsertBatch[] = [];
    upserts.batches$.subscribe((b) => seen.push(b));
    upserts.emit([], 'remote');
    expect(seen).toEqual([]);
  });
});
