import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { BoardView } from './board-view';
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
    provideHttpClient(),
    provideHttpClientTesting(),
  ];
}

function flushPageTypes(http: HttpTestingController): void {
  const req = http.match('/api/page-types');
  for (const r of req) r.flush({ pageTypes: [] });
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
    // refetch from bumpVersion
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
});
