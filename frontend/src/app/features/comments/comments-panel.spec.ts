import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { CommentsPanel } from './comments-panel';
import { Auth } from '../../core/auth/auth';
import type { Comment } from './comment.types';
import type { AuthUser } from '../../core/auth/auth.types';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function authStub(role: AuthUser['role'], userId = 'u-current') {
  const user = signal<AuthUser | null>({
    userId,
    email: 'u@x',
    displayName: 'U',
    role,
    emailVerified: true,
  });
  return { provide: Auth, useValue: { user: user.asReadonly() } };
}

function comment(over: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    parentId: null,
    authorId: 'u-current',
    authorName: 'Current User',
    body: 'hello',
    createdAt: '2026-01-01T00:00:00Z',
    editedAt: null,
    deletedAt: null,
    ...over,
  };
}

async function renderPanel(auth = authStub('Standard')) {
  const rendered = await render(CommentsPanel, {
    inputs: { pageGuid: 'p1' },
    providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting(), auth],
  });
  const http = TestBed.inject(HttpTestingController);
  return { ...rendered, http };
}

describe('CommentsPanel', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows an empty state when there are no comments', async () => {
    const { fixture, http } = await renderPanel();
    http.expectOne('/api/pages/p1/comments').flush({ comments: [] });
    await settle();
    fixture.detectChanges();
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('renders top-level comments with replies indented underneath', async () => {
    const { fixture, http } = await renderPanel();
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [
        comment({ id: 'top-1', authorName: 'Alice', body: 'Great page!' }),
        comment({ id: 'reply-1', parentId: 'top-1', authorName: 'Bob', body: 'Agreed' }),
      ],
    });
    await settle();
    fixture.detectChanges();

    expect(screen.getByText('Great page!')).toBeInTheDocument();
    expect(screen.getByText('Agreed')).toBeInTheDocument();
    const replyRow = screen.getByText('Agreed').closest('li.reply');
    expect(replyRow).not.toBeNull();
  });

  it('renders a [deleted] placeholder for a soft-deleted comment, replies still shown', async () => {
    const { fixture, http } = await renderPanel();
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [
        comment({ id: 'top-1', body: '', deletedAt: '2026-01-02T00:00:00Z' }),
        comment({ id: 'reply-1', parentId: 'top-1', authorName: 'Bob', body: 'Still here' }),
      ],
    });
    await settle();
    fixture.detectChanges();

    expect(screen.getByText('[deleted]')).toBeInTheDocument();
    expect(screen.getByText('Still here')).toBeInTheDocument();
  });

  it('shows edit/delete controls for your own comment', async () => {
    const { fixture, http } = await renderPanel(authStub('Standard', 'u-current'));
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [comment({ id: 'c1', authorId: 'u-current' })],
    });
    await settle();
    fixture.detectChanges();

    expect(screen.getByRole('button', { name: /edit comment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
  });

  it('hides edit/delete for a Standard user who is not the author', async () => {
    const { fixture, http } = await renderPanel(authStub('Standard', 'u-different'));
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [comment({ id: 'c1', authorId: 'u-current' })],
    });
    await settle();
    fixture.detectChanges();

    expect(screen.queryByRole('button', { name: /edit comment/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete comment/i })).toBeNull();
  });

  it('shows delete (but not edit) for an Admin who is not the author', async () => {
    const { fixture, http } = await renderPanel(authStub('Admin', 'u-admin'));
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [comment({ id: 'c1', authorId: 'u-current' })],
    });
    await settle();
    fixture.detectChanges();

    expect(screen.queryByRole('button', { name: /edit comment/i })).toBeNull();
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
  });

  it('posts a new top-level comment and clears the textbox', async () => {
    const { fixture, http } = await renderPanel();
    http.expectOne('/api/pages/p1/comments').flush({ comments: [] });
    await settle();
    fixture.detectChanges();

    const textarea = screen.getByPlaceholderText(/write a comment/i) as HTMLTextAreaElement;
    await userEvent.setup().type(textarea, 'A new comment');
    await userEvent.setup().click(screen.getByRole('button', { name: /^comment$/i }));

    const postReq = http.expectOne('/api/pages/p1/comments');
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ body: 'A new comment' });
    postReq.flush(comment({ id: 'new', body: 'A new comment' }));
    await settle();

    http.expectOne('/api/pages/p1/comments').flush({ comments: [comment({ id: 'new', body: 'A new comment' })] });
    await settle();
    fixture.detectChanges();
    expect((screen.getByPlaceholderText(/write a comment/i) as HTMLTextAreaElement).value).toBe('');
  });

  it('replies to a top-level comment with the parentId set', async () => {
    const { fixture, http } = await renderPanel();
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [comment({ id: 'top-1' })],
    });
    await settle();
    fixture.detectChanges();

    await userEvent.setup().click(screen.getByRole('button', { name: /^reply$/i }));
    const replyBox = screen.getByPlaceholderText(/write a reply/i) as HTMLTextAreaElement;
    await userEvent.setup().type(replyBox, 'My reply');
    // Two "Reply" buttons now exist: the per-thread toggle, and the reply
    // box's own submit button (last in DOM order).
    const replyButtons = screen.getAllByRole('button', { name: /^reply$/i });
    await userEvent.setup().click(replyButtons[replyButtons.length - 1]);

    const req = http
      .match((r) => r.method === 'POST' && r.url === '/api/pages/p1/comments')
      .find((r) => r.request.body?.parentId === 'top-1');
    expect(req).toBeDefined();
    req!.flush(comment({ id: 'reply-new', parentId: 'top-1', body: 'My reply' }));
    await settle();

    http.expectOne('/api/pages/p1/comments').flush({
      comments: [comment({ id: 'top-1' }), comment({ id: 'reply-new', parentId: 'top-1', body: 'My reply' })],
    });
    await settle();
  });

  it('deletes your own comment after confirming', async () => {
    const { fixture, http } = await renderPanel(authStub('Standard', 'u-current'));
    http.expectOne('/api/pages/p1/comments').flush({
      comments: [comment({ id: 'c1', authorId: 'u-current' })],
    });
    await settle();
    fixture.detectChanges();

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /delete comment/i }));
      const del = http.expectOne('/api/pages/p1/comments/c1');
      expect(del.request.method).toBe('DELETE');
      del.flush(null);
      await settle();
      http.expectOne('/api/pages/p1/comments').flush({ comments: [] });
      await settle();
    } finally {
      window.confirm = originalConfirm;
    }
  });
});
