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
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done', targetIndex: 0 });
    await settle();

    const updateReq = http.expectOne('/api/pages/card-drop');
    expect(updateReq.request.method).toBe('PUT');
    const body = updateReq.request.body as {
      properties: Record<string, { type: string; value: unknown }>;
      boardOrder: number;
    };
    expect(body.properties.state).toEqual({ type: 'string', value: 'Done' });
    expect(body.properties.owner).toEqual({ type: 'string', value: 'Dean' });
    // "Done" was empty, so the dropped card gets the base boardOrder.
    expect(body.boardOrder).toBe(1000);
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
    // sameCard is the only card in "To Do", i.e. already at index 0 — dropping
    // it back at index 0 with the same target state is a true no-op.
    await instance.onCardDropped({ card: sameCard, targetState: 'To Do', targetIndex: 0 });
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
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done', targetIndex: 0 });
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
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done', targetIndex: 0 });
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
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done', targetIndex: 0 });
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
    const dropped = instance.onCardDropped({ card: draggedCard, targetState: 'Done', targetIndex: 0 });
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

  // ---- step 5.4: positional boardOrder reorder ----

  it('same-column reorder issues a boardOrder-only PUT computed via the midpoint', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-reorder' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);

    const cardA = card({
      guid: 'card-a', title: 'Card A', boardOrder: 1000,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    const cardB = card({
      guid: 'card-b', title: 'Card B', boardOrder: 2000,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    // Starts at the bottom (highest boardOrder); the test drags it up to
    // between A and B.
    const mover = card({
      guid: 'card-mover', title: 'Mover Card', boardOrder: 5000,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    http.expectOne('/api/pages/parent-reorder/children?include=properties&limit=200').flush({
      children: [cardA, cardB, mover],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    // Drop between card A (index 0) and card B (index 1) — same column, so
    // only boardOrder changes; no `properties` in the PUT.
    const dropped = instance.onCardDropped({ card: mover, targetState: 'To Do', targetIndex: 1 });
    await settle();

    const updateReq = http.expectOne('/api/pages/card-mover');
    expect(updateReq.request.method).toBe('PUT');
    const body = updateReq.request.body as { boardOrder: number; properties?: unknown };
    expect(body).toEqual({ boardOrder: 1500 });

    updateReq.flush({
      guid: 'card-mover', title: 'Mover Card', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();
    http.expectOne('/api/pages/parent-reorder/children?include=properties&limit=200').flush({
      children: [cardA, { ...mover, boardOrder: 1500 }, cardB],
      hasMore: false,
    });
    await settle();
  });

  it('cross-column drop carries both state and boardOrder in one PUT', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-cross' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);

    const moving = card({
      guid: 'card-moving', title: 'Moving Card',
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    const doneCard = card({
      guid: 'card-done', title: 'Done Card', boardOrder: 1000,
      properties: { state: { type: 'string', value: 'Done' } },
    });
    http.expectOne('/api/pages/parent-cross/children?include=properties&limit=200').flush({
      children: [moving, doneCard],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    // Drop at the top of "Done" (index 0), above the existing card.
    const dropped = instance.onCardDropped({ card: moving, targetState: 'Done', targetIndex: 0 });
    await settle();

    const updateReq = http.expectOne('/api/pages/card-moving');
    const body = updateReq.request.body as {
      boardOrder: number;
      properties: Record<string, { type: string; value: unknown }>;
    };
    expect(body.boardOrder).toBe(0); // 1000 - 1000
    expect(body.properties.state).toEqual({ type: 'string', value: 'Done' });

    updateReq.flush({
      guid: 'card-moving', title: 'Moving Card', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();
    http.expectOne('/api/pages/parent-cross/children?include=properties&limit=200').flush({
      children: [{ ...moving, boardOrder: 0, properties: { state: { type: 'string', value: 'Done' } } }, doneCard],
      hasMore: false,
    });
    await settle();
  });

  it('renumbers the whole column and PUTs only the cards whose boardOrder actually changed', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-renumber' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);

    const cardA = card({
      guid: 'card-a', title: 'Card A', boardOrder: 1000,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    const cardB = card({
      guid: 'card-b', title: 'Card B', boardOrder: 1001,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    const mover = card({
      guid: 'card-mover', title: 'Mover Card', boardOrder: 5000,
      properties: { state: { type: 'string', value: 'Backlog' } },
    });
    http.expectOne('/api/pages/parent-renumber/children?include=properties&limit=200').flush({
      children: [cardA, cardB, mover],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    // Drop the mover between card A and card B — gap is 1, too small for a
    // distinct integer midpoint, so the whole "To Do" column renumbers.
    const dropped = instance.onCardDropped({ card: mover, targetState: 'To Do', targetIndex: 1 });
    await settle();

    // card-a's renumbered value (1000) is exactly its existing boardOrder —
    // it didn't actually move, so it must NOT be PUT (the fix for the
    // review finding: the renumber fallback used to PUT every card
    // unconditionally, including ones whose value didn't change).
    http.expectNone('/api/pages/card-a');

    const reqMover = http.expectOne('/api/pages/card-mover');
    const reqB = http.expectOne('/api/pages/card-b');

    const moverBody = reqMover.request.body as { boardOrder: number; properties: unknown };
    expect(moverBody.boardOrder).toBe(2000);
    expect((moverBody.properties as Record<string, { value: unknown }>)['state']).toEqual({
      type: 'string', value: 'To Do',
    });
    expect(reqB.request.body).toEqual({ boardOrder: 3000 });

    reqB.flush({
      guid: 'card-b', title: 'Card B', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await settle();
    reqMover.flush({
      guid: 'card-mover', title: 'Mover Card', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();

    // Each successful updatePage call bumps children:any, so multiple resets
    // may fire — drain them all with the final authoritative state.
    const pending = http
      .match('/api/pages/parent-renumber/children?include=properties&limit=200')
      .filter((req) => !req.cancelled);
    for (const req of pending) {
      req.flush({
        children: [
          { ...cardA, boardOrder: 1000 },
          { ...mover, boardOrder: 2000, properties: { state: { type: 'string', value: 'To Do' } } },
          { ...cardB, boardOrder: 3000 },
        ],
        hasMore: false,
      });
    }
    await settle();
  });

  it('cross-column drop still PUTs the mover\'s state when its own renumbered boardOrder coincidentally equals its pre-drop value', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-coincidence' },
    });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    flushPageTypes(http);

    // Destination column "Done" has a tight gap (1000/1001) that forces the
    // renumber fallback. Inserted at index 1, the mover renumbers to 2000 —
    // which happens to be exactly the boardOrder it already carried from its
    // PREVIOUS column ("Backlog"), the fix wave 1 filter's blind spot: the
    // renumber result omits the mover entirely even though its `state` is
    // changing. cardX (1000 -> 1000) is likewise omitted since it doesn't
    // move; cardY (1001 -> 3000) genuinely changes and stays in.
    const cardX = card({
      guid: 'card-x', title: 'Card X', boardOrder: 1000,
      properties: { state: { type: 'string', value: 'Done' } },
    });
    const cardY = card({
      guid: 'card-y', title: 'Card Y', boardOrder: 1001,
      properties: { state: { type: 'string', value: 'Done' } },
    });
    const mover = card({
      guid: 'card-coincidence', title: 'Coincidence Card', boardOrder: 2000,
      properties: { state: { type: 'string', value: 'Backlog' } },
    });
    http.expectOne('/api/pages/parent-coincidence/children?include=properties&limit=200').flush({
      children: [cardX, cardY, mover],
      hasMore: false,
    });
    await settle();
    expect(columnCount('Backlog')).toBe('1');
    expect(columnCount('Done')).toBe('2');

    const instance = fixture.componentInstance;
    const dropped = instance.onCardDropped({ card: mover, targetState: 'Done', targetIndex: 1 });
    await settle();

    // The card visually moved into "Done" even though its own boardOrder
    // was filtered as "unchanged" — this is the regression: without the
    // fix, the mover is skipped by both the optimistic patch and the PUT
    // loop, so it silently stays put. "Backlog" is now empty and (being
    // unconfigured) disappears entirely, same as other tests' empty-column
    // assertions.
    expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
    expect(columnCount('Done')).toBe('3');

    // card-x didn't move — no PUT for it.
    http.expectNone('/api/pages/card-x');

    const reqY = http.expectOne('/api/pages/card-y');
    expect(reqY.request.body).toEqual({ boardOrder: 3000 });

    // The mover's PUT must still fire, carrying the `state` change. Its own
    // boardOrder genuinely didn't change (2000 -> 2000), so the body must
    // NOT carry a boardOrder field — only `properties`.
    const reqMover = http.expectOne('/api/pages/card-coincidence');
    const moverBody = reqMover.request.body as {
      boardOrder?: number;
      properties: Record<string, { type: string; value: unknown }>;
    };
    expect(moverBody.boardOrder).toBeUndefined();
    expect(moverBody.properties.state).toEqual({ type: 'string', value: 'Done' });

    reqY.flush({
      guid: 'card-y', title: 'Card Y', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await settle();
    reqMover.flush({
      guid: 'card-coincidence', title: 'Coincidence Card', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await dropped;
    await settle();

    const pending = http
      .match('/api/pages/parent-coincidence/children?include=properties&limit=200')
      .filter((req) => !req.cancelled);
    for (const req of pending) {
      req.flush({
        children: [
          cardX,
          { ...cardY, boardOrder: 3000 },
          { ...mover, properties: { state: { type: 'string', value: 'Done' } } },
        ],
        hasMore: false,
      });
    }
    await settle();

    expect(columnCount('Done')).toBe('3');
    expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
  });

  it('rolls back only the cards whose PUT failed in a renumber batch', async () => {
    const { fixture } = await render(BoardView, {
      providers: baseProviders(),
      inputs: { parentGuid: 'parent-renumber-fail' },
    });
    const http = TestBed.inject(HttpTestingController);
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    await settle();
    flushPageTypes(http);

    // 999/1000 (rather than 1000/1001) so that BOTH neighbours' renumbered
    // values (1000/3000) genuinely differ from their current boardOrder —
    // keeping all three cards in the PUT batch so this test still exercises
    // partial-failure rollback across three requests, not two.
    const cardA = card({
      guid: 'card-a2', title: 'Card A2', boardOrder: 999,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    const cardB = card({
      guid: 'card-b2', title: 'Card B2', boardOrder: 1000,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    const mover = card({
      guid: 'card-mover2', title: 'Mover Card2', boardOrder: 5000,
      properties: { state: { type: 'string', value: 'To Do' } },
    });
    http.expectOne('/api/pages/parent-renumber-fail/children?include=properties&limit=200').flush({
      children: [cardA, cardB, mover],
      hasMore: false,
    });
    await settle();

    const instance = fixture.componentInstance;
    const dropped = instance.onCardDropped({ card: mover, targetState: 'To Do', targetIndex: 1 });
    await settle();

    const reqA = http.expectOne('/api/pages/card-a2');
    const reqMover = http.expectOne('/api/pages/card-mover2');
    const reqB = http.expectOne('/api/pages/card-b2');

    // card-b2's PUT fails; the other two succeed.
    reqA.flush({
      guid: 'card-a2', title: 'Card A2', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await settle();
    reqMover.flush({
      guid: 'card-mover2', title: 'Mover Card2', content: '', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await settle();
    reqB.flush({ message: 'Card B is locked' }, { status: 409, statusText: 'Conflict' });
    await dropped;
    await settle();

    expect(openSpy).toHaveBeenCalledWith(
      "Couldn't move card — Card B is locked",
      'Dismiss',
      { duration: 4000 },
    );

    // Drain the resets triggered by the two successful PUTs.
    const pending = http
      .match('/api/pages/parent-renumber-fail/children?include=properties&limit=200')
      .filter((req) => !req.cancelled);
    for (const req of pending) {
      req.flush({
        children: [
          { ...cardA, boardOrder: 1000 },
          { ...mover, boardOrder: 2000 },
          cardB, // unchanged server-side — its PUT failed
        ],
        hasMore: false,
      });
    }
    await settle();
  });
});
