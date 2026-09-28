import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Comments } from './comments';
import type { Comment } from './comment.types';

function comment(over: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    parentId: null,
    authorId: 'user-1',
    authorName: 'User One',
    body: 'hello',
    createdAt: '2026-01-01T00:00:00Z',
    editedAt: null,
    deletedAt: null,
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Comments service', () => {
  let http: HttpTestingController;
  let comments: Comments;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Comments],
    });
    http = TestBed.inject(HttpTestingController);
    comments = TestBed.inject(Comments);
  });

  afterEach(() => http.verify());

  describe('listResource', () => {
    it('GETs /api/pages/{guid}/comments', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => comments.listResource(guid));
      await settle();
      const req = http.expectOne('/api/pages/p1/comments');
      expect(req.request.method).toBe('GET');
      req.flush({ comments: [comment({ id: 'c1' })] });
      await settle();
      expect(resource.value()?.[0].id).toBe('c1');
    });

    it('re-requests after addComment for the same page (scoped invalidation)', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => comments.listResource(guid));
      await settle();
      http.expectOne('/api/pages/p1/comments').flush({ comments: [] });
      await settle();

      const promise = comments.addComment('p1', { body: 'new comment' });
      http.expectOne('/api/pages/p1/comments').flush(comment({ id: 'new' }));
      await promise;
      await settle();

      http.expectOne('/api/pages/p1/comments').flush({ comments: [comment({ id: 'new' })] });
      await settle();
      expect(resource.value()?.[0].id).toBe('new');
    });

    it('addComment on p1 does not re-request listResource(p2)', async () => {
      const g1 = signal<string | null>('p1');
      const g2 = signal<string | null>('p2');
      TestBed.runInInjectionContext(() => comments.listResource(g1));
      const r2 = TestBed.runInInjectionContext(() => comments.listResource(g2));
      await settle();
      http.expectOne('/api/pages/p1/comments').flush({ comments: [] });
      http.expectOne('/api/pages/p2/comments').flush({ comments: [comment({ id: 'keep' })] });
      await settle();

      const promise = comments.addComment('p1', { body: 'x' });
      http.expectOne('/api/pages/p1/comments').flush(comment({ id: 'x' }));
      await promise;
      await settle();

      http.expectOne('/api/pages/p1/comments').flush({ comments: [comment({ id: 'x' })] });
      http.expectNone('/api/pages/p2/comments');
      await settle();
      expect(r2.value()?.[0].id).toBe('keep');
    });

    it('does not fetch when guid is null', async () => {
      const guid = signal<string | null>(null);
      TestBed.runInInjectionContext(() => comments.listResource(guid));
      await settle();
      http.expectNone(() => true);
    });
  });

  describe('addComment', () => {
    it('POSTs the body and optional parentId', async () => {
      const promise = comments.addComment('p1', { body: 'hi', parentId: 'parent-1' });
      const req = http.expectOne('/api/pages/p1/comments');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ body: 'hi', parentId: 'parent-1' });
      req.flush(comment({ id: 'new' }));
      await expect(promise).resolves.toEqual(comment({ id: 'new' }));
    });
  });

  describe('updateComment', () => {
    it('PUTs the new body', async () => {
      const promise = comments.updateComment('p1', 'c1', 'edited');
      const req = http.expectOne('/api/pages/p1/comments/c1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ body: 'edited' });
      req.flush(comment({ id: 'c1', body: 'edited' }));
      await promise;
    });
  });

  describe('deleteComment', () => {
    it('sends DELETE /api/pages/{guid}/comments/{commentId}', async () => {
      const promise = comments.deleteComment('p1', 'c1');
      const req = http.expectOne('/api/pages/p1/comments/c1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await promise;
    });
  });
});
