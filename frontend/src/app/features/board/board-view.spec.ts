import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BoardView } from './board-view';
import { errorInterceptor } from '../../core/api/error-interceptor';
import type { PageChildDetail } from '../pages/page.types';

function card(over: Partial<PageChildDetail> = {}): PageChildDetail {
  return {
    guid: 'c1',
    title: 'Card',
    parentGuid: 'p1',
    status: 'published',
    modifiedAt: '2026-01-01T00:00:00Z',
    modifiedBy: 'u',
    hasChildren: false,
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function baseProviders() {
  return [
    provideAnimationsAsync(),
    provideRouter([]),
    // errorInterceptor mirrors production (app.config.ts) so a failed PUT's
    // body `message` surfaces the same way it does in the real app —
    // needed to assert the toast text on rollback.
    provideHttpClient(withInterceptors([errorInterceptor])),
    provideHttpClientTesting(),
  ];
}

function flushPageTypes(http: HttpTestingController): void {
  const req = http.match('/api/page-types');
  for (const r of req) r.flush({ pageTypes: [] });
}

/** Reads the card count badge for the column whose header shows `name`. */
function columnCount(name: string): string {
  const header = screen.getByText(name).closest('.header') as HTMLElement;
  return within(header).getByTestId('board-column-count').textContent?.trim() ?? '';
}

describe('BoardView', () => {
  it('renders a column per grouped state', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-1' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    const childReq = http.expectOne('/api/pages/parent-1/children?include=properties&limit=200');
    childReq.flush({
      children: [
        card({ guid: 'a', title: 'Card A', properties: { state: { type: 'string', value: 'To Do' } } }),
        card({ guid: 'b', title: 'Card B', properties: { state: { type: 'string', value: 'Done' } } }),
      ],
      hasMore: false,
    });
    await settle();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card b/i })).toBeInTheDocument();
  });

  it('shows a loading indicator while fetching', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-loading' },
    });
    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    const http = TestBed.inject(HttpTestingController);
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-loading/children?include=properties&limit=200').flush({
      children: [], hasMore: false,
    });
  });

  it('shows an error state when the fetch fails', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-error' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-error/children?include=properties&limit=200').flush(
      { message: 'boom' },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    fixture.detectChanges();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('calls pages.updatePage with merged state when a card is dropped', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-drop' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    const draggedCard = card({
      guid: 'card-drop',
      title: 'Drop me',
      properties: {
        state: { type: 'string', value: 'To Do' },
        owner: { type: 'string', value: 'Dean' },
      },
    });
    http.expectOne('/api/pages/parent-drop/children?include=properties&limit=200').flush({
      children: [draggedCard],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done' });
    await settle();

    const updateReq = http.expectOne('/api/pages/card-drop');
    expect(updateReq.request.method).toBe('PUT');
    const body = updateReq.request.body as {
      properties: Record<string, { type: string; value: unknown }>;
    };
    expect(body.properties.state).toEqual({ type: 'string', value: 'Done' });
    expect(body.properties.owner).toEqual({ type: 'string', value: 'Dean' });
    updateReq.flush({
      guid: 'card-drop', title: 'Drop me', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();
    // updatePage bumps children:any on the invalidation bus, so the board's
    // children-with-properties resource re-requests
    http.expectOne('/api/pages/parent-drop/children?include=properties&limit=200').flush({
      children: [], hasMore: false,
    });
    await settle();
  });

  it('skips updatePage when dropping into the current column', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-noop' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    const sameCard = card({
      guid: 'same',
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    http.expectOne('/api/pages/parent-noop/children?include=properties&limit=200').flush({
      children: [sameCard], hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    await instance.onCardDropped({ card: sameCard, targetState: 'To Do' });
    http.expectNone('/api/pages/same');
  });

  it('hides the parent subtitle on cards when boardConfig.showParentTitle is false', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: {
        parentGuid: 'parent-no-parent-title',
        boardConfig: { showParentTitle: false },
      },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-no-parent-title/children?include=properties&limit=200').flush({
      children: [
        card({
          guid: 'a',
          title: 'Card A',
          parentTitle: 'Parent A',
          properties: { state: { type: 'string', value: 'To Do' } },
        }),
      ],
      hasMore: false,
    });
    await settle();
    expect(screen.getByRole('button', { name: /card a/i })).toBeInTheDocument();
    expect(screen.queryByTestId('board-card-secondary')).not.toBeInTheDocument();
  });

  it('shows the parent subtitle on cards by default when boardConfig.showParentTitle is unset', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-default-parent-title' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-default-parent-title/children?include=properties&limit=200').flush({
      children: [
        card({
          guid: 'a',
          title: 'Card A',
          parentTitle: 'Parent A',
          properties: { state: { type: 'string', value: 'To Do' } },
        }),
      ],
      hasMore: false,
    });
    await settle();
    expect(screen.getByTestId('board-card-secondary')).toHaveTextContent('Parent A');
  });

  it('shows a "Load more cards" button when hasMore is true, and none when false', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-more' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-more/children?include=properties&limit=200').flush({
      children: [card({ guid: 'a', title: 'Card A' })],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    await settle();

    expect(screen.getByRole('button', { name: /load more cards/i })).toBeInTheDocument();
  });

  it('omits the "Load more cards" button when hasMore is false', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-no-more' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-no-more/children?include=properties&limit=200').flush({
      children: [card({ guid: 'a', title: 'Card A' })],
      hasMore: false,
    });
    await settle();

    expect(screen.queryByRole('button', { name: /load more cards/i })).not.toBeInTheDocument();
  });

  it('clicking "Load more cards" fetches with nextCursor and appends the result', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-load' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-load/children?include=properties&limit=200').flush({
      children: [
        card({ guid: 'a', title: 'Card A', properties: { state: { type: 'string', value: 'To Do' } } }),
      ],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    await settle();

    screen.getByRole('button', { name: /load more cards/i }).click();
    await settle();

    const nextReq = http.expectOne(
      '/api/pages/parent-load/children?include=properties&limit=200&cursor=cursor-1',
    );
    nextReq.flush({
      children: [
        card({ guid: 'b', title: 'Card B', properties: { state: { type: 'string', value: 'Done' } } }),
      ],
      hasMore: false,
    });
    await settle();

    expect(screen.getByRole('button', { name: /card a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card b/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more cards/i })).not.toBeInTheDocument();
  });

  it('shows a loading state on the button while fetching the next page', async () => {
    await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-loading-more' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-loading-more/children?include=properties&limit=200').flush({
      children: [card({ guid: 'a', title: 'Card A' })],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    await settle();

    screen.getByRole('button', { name: /load more cards/i }).click();
    await settle();

    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();

    const nextReq = http.expectOne(
      '/api/pages/parent-loading-more/children?include=properties&limit=200&cursor=cursor-1',
    );
    nextReq.flush({ children: [], hasMore: false });
    await settle();
  });

  it('resets the accumulator when the parent changes', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-reset-a' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);
    http.expectOne('/api/pages/parent-reset-a/children?include=properties&limit=200').flush({
      children: [card({ guid: 'a', title: 'Card A' })],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    await settle();
    expect(screen.getByRole('button', { name: /card a/i })).toBeInTheDocument();

    fixture.componentRef.setInput('parentGuid', 'parent-reset-b');
    await settle();
    http.expectOne('/api/pages/parent-reset-b/children?include=properties&limit=200').flush({
      children: [card({ guid: 'c', title: 'Card C' })],
      hasMore: false,
    });
    await settle();

    expect(screen.queryByRole('button', { name: /card a/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card c/i })).toBeInTheDocument();
  });

  it('discards a stale "Load more" response when a reset lands while it is in flight', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-race' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);

    const draggedCard = card({
      guid: 'card-race',
      title: 'Race Card',
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    http.expectOne('/api/pages/parent-race/children?include=properties&limit=200').flush({
      children: [draggedCard],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    await settle();

    // Start "Load more" (request A) but do not resolve it yet.
    const instance = fixture.componentInstance;
    const loadMorePromise = instance.onLoadMore();
    await settle();
    const loadMoreReq = http.expectOne(
      '/api/pages/parent-race/children?include=properties&limit=200&cursor=cursor-1',
    );

    // Before A resolves, something elsewhere bumps the coarse `children:any`
    // invalidation tag (e.g. dragging a card into a new column calls
    // updatePage) — this re-fetches page one and resets the accumulator.
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done' });
    await settle();
    const updateReq = http.expectOne('/api/pages/card-race');
    updateReq.flush({
      guid: 'card-race', title: 'Race Card', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();

    const freshReq = http.expectOne('/api/pages/parent-race/children?include=properties&limit=200');
    freshReq.flush({
      children: [card({ guid: 'fresh', title: 'Fresh Card' })],
      hasMore: false,
    });
    await settle();

    // The reset has already landed and won: fresh page one is shown, no
    // "Load more" button (hasMore: false on the fresh response).
    expect(screen.getByRole('button', { name: /fresh card/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more cards/i })).not.toBeInTheDocument();

    // Now the stale request A finally resolves.
    loadMoreReq.flush({
      children: [card({ guid: 'stale', title: 'Stale Card' })],
      hasMore: true,
      nextCursor: 'stale-cursor',
    });
    await loadMorePromise;
    await settle();

    // The stale response must be discarded silently: no stale card appended,
    // and it must not resurrect the "Load more" button with its stale
    // hasMore/nextCursor.
    expect(screen.queryByRole('button', { name: /stale card/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fresh card/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more cards/i })).not.toBeInTheDocument();
  });

  it('moves the card to the target column immediately on drop, and it stays after the PUT succeeds', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-optimistic' },
    });
    const http = TestBed.inject(HttpTestingController);
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    await settle();
    flushPageTypes(http);

    const draggedCard = card({
      guid: 'card-opt',
      title: 'Optimistic Card',
      properties: {
        state: { type: 'string', value: 'To Do' },
        owner: { type: 'string', value: 'Dean' },
      },
    });
    http.expectOne('/api/pages/parent-optimistic/children?include=properties&limit=200').flush({
      children: [draggedCard],
      hasMore: false,
    });
    await settle();
    expect(columnCount('To Do')).toBe('1');

    const instance = fixture.componentInstance;
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done' });
    await settle();

    // The card has already moved even though the PUT is still pending —
    // the "To Do" column has no cards left in it (and disappears, since
    // unconfigured empty columns aren't rendered) while "Done" shows it.
    expect(screen.queryByText('To Do')).not.toBeInTheDocument();
    expect(columnCount('Done')).toBe('1');
    expect(screen.getByRole('button', { name: /optimistic card/i })).toBeInTheDocument();

    const updateReq = http.expectOne('/api/pages/card-opt');
    expect(updateReq.request.method).toBe('PUT');
    const body = updateReq.request.body as {
      properties: Record<string, { type: string; value: unknown }>;
    };
    expect(body.properties.state).toEqual({ type: 'string', value: 'Done' });
    expect(body.properties.owner).toEqual({ type: 'string', value: 'Dean' });

    updateReq.flush({
      guid: 'card-opt', title: 'Optimistic Card', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();

    // updatePage bumps children:any, so the board's children-with-properties
    // resource re-requests page one — reconcile with the server's state
    // without any visible jump (the optimistic move already showed "Done").
    http.expectOne('/api/pages/parent-optimistic/children?include=properties&limit=200').flush({
      children: [{
        ...draggedCard,
        properties: { ...draggedCard.properties, state: { type: 'string', value: 'Done' } },
      }],
      hasMore: false,
    });
    await settle();

    expect(columnCount('Done')).toBe('1');
    expect(screen.queryByText('To Do')).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('rolls back to the source column and shows a toast with the server message when the PUT fails', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-fail-move' },
    });
    const http = TestBed.inject(HttpTestingController);
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    await settle();
    flushPageTypes(http);

    const draggedCard = card({
      guid: 'card-fail',
      title: 'Fail Card',
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    http.expectOne('/api/pages/parent-fail-move/children?include=properties&limit=200').flush({
      children: [draggedCard],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done' });
    await settle();
    expect(columnCount('Done')).toBe('1');
    expect(screen.queryByText('To Do')).not.toBeInTheDocument();

    const updateReq = http.expectOne('/api/pages/card-fail');
    updateReq.flush({ message: 'Card is locked' }, { status: 409, statusText: 'Conflict' });
    await dropped;
    await settle();

    // Rolled back to the source column; "Done" is empty again and (being
    // unconfigured) disappears.
    expect(columnCount('To Do')).toBe('1');
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(openSpy).toHaveBeenCalledWith(
      "Couldn't move card — Card is locked",
      'Dismiss',
      { duration: 4000 },
    );
  });

  it('does not resurrect a stale card when a reset lands before a failed move resolves', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-race-move' },
    });
    const http = TestBed.inject(HttpTestingController);
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    await settle();
    flushPageTypes(http);

    const draggedCard = card({
      guid: 'card-race-move',
      title: 'Race Move Card',
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    http.expectOne('/api/pages/parent-race-move/children?include=properties&limit=200').flush({
      children: [draggedCard],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done' });
    await settle();
    const updateReq = http.expectOne('/api/pages/card-race-move');

    // Before the PUT resolves, the parent changes — this resets the
    // accumulator (a fresh page one, new generation) out from under the
    // in-flight optimistic move.
    fixture.componentRef.setInput('parentGuid', 'parent-race-move-2');
    await settle();
    http.expectOne('/api/pages/parent-race-move-2/children?include=properties&limit=200').flush({
      children: [
        card({
          guid: 'fresh',
          title: 'Fresh Card',
          properties: { state: { type: 'string', value: 'To Do' } },
        }),
      ],
      hasMore: false,
    });
    await settle();
    expect(screen.getByRole('button', { name: /fresh card/i })).toBeInTheDocument();

    // Now the stale PUT finally fails.
    updateReq.flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    await dropped;
    await settle();

    // A toast still informs the user the move failed…
    expect(openSpy).toHaveBeenCalled();
    // …but the rollback must not resurrect the stale card into the freshly
    // reset board — it belongs to a different parent's accumulator now.
    expect(screen.queryByRole('button', { name: /race move card/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fresh card/i })).toBeInTheDocument();
  });
});
