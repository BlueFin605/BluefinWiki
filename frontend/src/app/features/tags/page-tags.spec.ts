import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PageTags } from './page-tags';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function vocab(tags: string[], scope: string) {
  return {
    scope,
    tags: tags.map((tag) => ({ scope, tag, createdAt: '', createdBy: '', usageCount: 1 })),
  };
}

describe('PageTags.multiVocabResource', () => {
  let tags: PageTags;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    tags = TestBed.inject(PageTags);
    http = TestBed.inject(HttpTestingController);
  });

  it('fetches one vocabulary per scope and keys the result by scope', async () => {
    const res = TestBed.runInInjectionContext(() =>
      tags.multiVocabResource(() => ['genre', 'mood']),
    );
    await settle();
    http.expectOne('/api/tags?scope=genre').flush(vocab(['jazz', 'rock'], 'genre'));
    http.expectOne('/api/tags?scope=mood').flush(vocab(['calm'], 'mood'));
    await settle();

    expect(res.value()).toEqual({ genre: ['jazz', 'rock'], mood: ['calm'] });
    expect(res.status()).toBe('resolved');
  });

  it('makes no request for an empty scope set and resolves to {}', async () => {
    const res = TestBed.runInInjectionContext(() => tags.multiVocabResource(() => []));
    await settle();

    http.expectNone(() => true);
    expect(res.value()).toEqual({});
  });

  it('a single failing scope does not blank the others', async () => {
    const res = TestBed.runInInjectionContext(() =>
      tags.multiVocabResource(() => ['genre', 'mood']),
    );
    await settle();
    http.expectOne('/api/tags?scope=genre').flush(vocab(['jazz'], 'genre'));
    http
      .expectOne('/api/tags?scope=mood')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(res.status()).toBe('resolved');
    expect(res.value()).toEqual({ genre: ['jazz'], mood: [] });
  });

  afterEach(() => http.verify());
});
