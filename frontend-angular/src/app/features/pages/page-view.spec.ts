import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { convertToParamMap, type ParamMap } from '@angular/router';

jest.mock('mermaid', () => ({
  default: {
    initialize: jest.fn(),
    parse: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg/>' }),
  },
}));

import { PageView } from './page-view';

function activatedRouteWithGuid(guid: string | null) {
  const paramMap: ParamMap = convertToParamMap(guid ? { guid } : {});
  return {
    provide: ActivatedRoute,
    useValue: { paramMap: of(paramMap) },
  };
}

describe('PageView', () => {
  it('shows a loading indicator while fetching', async () => {
    await render(PageView, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), activatedRouteWithGuid('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // Don't flush — leave the request pending to keep the loading state visible
    http.expectOne('/api/pages/g1').flush({
      guid: 'g1', title: 'T', content: '# Hi', folderId: 'f', tags: [],
      status: 'published', createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
  });

  it('renders the markdown content', async () => {
    const { fixture } = await render(PageView, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), activatedRouteWithGuid('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush({
      guid: 'g1', title: 'T', content: '# Hello world',
      folderId: 'f', tags: [], status: 'published',
      createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    // The breadcrumbs component mounts and fires an ancestors fetch — drain it.
    http.expectOne('/api/pages/g1/ancestors').flush({ ancestors: [] });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByRole('heading', { name: 'Hello world' })).toBeInTheDocument();
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  function flushAncestors(http: HttpTestingController, guid: string): void {
    const reqs = http.match(`/api/pages/${guid}/ancestors`);
    for (const r of reqs) r.flush({ ancestors: [] });
  }

  function flushChildrenWithProps(http: HttpTestingController, guid: string): void {
    const reqs = http.match((r) => r.url === `/api/pages/${guid}/children?include=properties&limit=200`);
    for (const r of reqs) r.flush({ children: [], hasMore: false });
  }

  function flushPageTypes(http: HttpTestingController): void {
    const reqs = http.match('/api/page-types');
    for (const r of reqs) r.flush({ pageTypes: [] });
  }

  it('renders the BoardView when the page has a boardConfig with defaultView=board', async () => {
    const { fixture } = await render(PageView, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        activatedRouteWithGuid('board-page'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/board-page').flush({
      guid: 'board-page', title: 'Board page', content: '# Hi',
      folderId: 'f', tags: [], status: 'published',
      createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
      boardConfig: { columns: ['To Do', 'Done'], defaultView: 'board' },
    });
    await settle();
    flushAncestors(http, 'board-page');
    flushPageTypes(http);
    flushChildrenWithProps(http, 'board-page');
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('toggles from Content to Board view when the user clicks the Board toggle', async () => {
    const { fixture } = await render(PageView, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        activatedRouteWithGuid('toggle-page'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/toggle-page').flush({
      guid: 'toggle-page', title: 'Toggle page', content: '# Greetings',
      folderId: 'f', tags: [], status: 'published',
      createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
      boardConfig: { columns: ['Alpha'], defaultView: 'content' },
    });
    await settle();
    flushAncestors(http, 'toggle-page');
    await settle();
    fixture.detectChanges();
    // Starts on content
    expect(screen.getByRole('heading', { name: 'Greetings' })).toBeInTheDocument();
    const boardToggle = screen.getByRole('radio', { name: /board/i });
    await userEvent.click(boardToggle);
    flushPageTypes(http);
    flushChildrenWithProps(http, 'toggle-page');
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('does not show the board toggle when the page has no boardConfig', async () => {
    const { fixture } = await render(PageView, {
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        activatedRouteWithGuid('no-board'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/no-board').flush({
      guid: 'no-board', title: 'Plain', content: '# Plain',
      folderId: 'f', tags: [], status: 'published',
      createdBy: '', modifiedBy: '', createdAt: '', modifiedAt: '',
    });
    await settle();
    flushAncestors(http, 'no-board');
    await settle();
    fixture.detectChanges();
    expect(screen.queryByRole('radio', { name: /board/i })).toBeNull();
  });

  it('shows an error state on fetch failure', async () => {
    const { fixture } = await render(PageView, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), activatedRouteWithGuid('g1')],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1').flush(
      { message: 'Not found' },
      { status: 404, statusText: 'Not Found' },
    );
    for (let i = 0; i < 5; i++) await Promise.resolve();
    TestBed.tick();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
