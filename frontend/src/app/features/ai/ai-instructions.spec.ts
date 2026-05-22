import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AiInstructions, AI_INSTRUCTIONS_ROOT_TITLE } from './ai-instructions';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('AiInstructions service', () => {
  let http: HttpTestingController;
  let svc: AiInstructions;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(AiInstructions);
    svc.__clearCacheForTests();
  });

  afterEach(() => http.verify());

  it('listInstructions returns [] when the root page does not exist', async () => {
    const promise = svc.listInstructions();
    await settle();
    const rootReq = http.expectOne('/api/pages/root/children');
    rootReq.flush({ children: [{ guid: 'g1', title: 'Other Page' }] });

    await expect(promise).resolves.toEqual([]);
  });

  it('listInstructions returns the children of the AI Instructions root', async () => {
    const promise = svc.listInstructions();
    await settle();
    http
      .expectOne('/api/pages/root/children')
      .flush({
        children: [
          { guid: 'root-guid', title: AI_INSTRUCTIONS_ROOT_TITLE },
          { guid: 'other', title: 'Other' },
        ],
      });
    await settle();
    const childrenReq = http.expectOne('/api/pages/root-guid/children');
    childrenReq.flush({
      children: [
        { guid: 'i1', title: 'Summarise tone' },
        { guid: 'i2', title: 'Recipe writer' },
      ],
    });

    await expect(promise).resolves.toEqual([
      { guid: 'i1', title: 'Summarise tone' },
      { guid: 'i2', title: 'Recipe writer' },
    ]);
  });

  it('getInstructionContent GETs /api/pages/:guid and returns the content', async () => {
    const promise = svc.getInstructionContent('i1');
    await settle();
    const req = http.expectOne('/api/pages/i1');
    req.flush({
      guid: 'i1',
      title: 'Summarise tone',
      content: '# Tone\nBe terse.',
      folderId: 'f',
      tags: [],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });

    await expect(promise).resolves.toEqual({
      guid: 'i1',
      title: 'Summarise tone',
      content: '# Tone\nBe terse.',
    });
  });

  it('createInstruction lazy-creates the root page when missing then posts the child', async () => {
    const promise = svc.createInstruction('New instruction');
    await settle();
    // First look up the root.
    http
      .expectOne('/api/pages/root/children')
      .flush({ children: [] });
    await settle();
    // Root not found → POST to create it.
    const createRootReq = http.expectOne(
      (r) => r.url === '/api/pages' && r.method === 'POST',
    );
    const rootBody = createRootReq.request.body as Record<string, unknown>;
    expect(rootBody['title']).toBe(AI_INSTRUCTIONS_ROOT_TITLE);
    expect(rootBody['parentGuid']).toBeNull();
    expect(typeof rootBody['content']).toBe('string');
    createRootReq.flush({
      guid: 'new-root',
      title: AI_INSTRUCTIONS_ROOT_TITLE,
      content: 'root',
      folderId: 'f',
      tags: [],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });
    await settle();

    const childReq = http.expectOne(
      (r) => r.url === '/api/pages' && r.method === 'POST',
    );
    expect(childReq.request.body).toMatchObject({
      title: 'New instruction',
      parentGuid: 'new-root',
    });
    childReq.flush({
      guid: 'new-child',
      title: 'New instruction',
      content: 'template',
      folderId: 'f',
      tags: [],
      status: 'published',
      createdBy: 'u',
      modifiedBy: 'u',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
    });

    await expect(promise).resolves.toBe('new-child');
  });
});
