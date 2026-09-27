import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminTasks, type RebuildResult } from './admin-tasks';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('AdminTasks service', () => {
  let http: HttpTestingController;
  let admin: AdminTasks;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AdminTasks],
    });
    http = TestBed.inject(HttpTestingController);
    admin = TestBed.inject(AdminTasks);
  });

  afterEach(() => http.verify());

  it('rebuildPageIndex POSTs to /api/admin/rebuild-page-index', async () => {
    const promise = admin.rebuildPageIndex();
    await settle();
    const post = http.expectOne('/api/admin/rebuild-page-index');
    expect(post.request.method).toBe('POST');
    const stubResult: RebuildResult = {
      totalPages: 10,
      indexed: 9,
      failed: 1,
      errors: ['something'],
      durationMs: 1234,
      deletedOrphans: 0,
      orphanGuids: [],
    };
    post.flush(stubResult);
    const result = await promise;
    expect(result.totalPages).toBe(10);
    expect(result.indexed).toBe(9);
    expect(result.errors).toEqual(['something']);
  });
});
