import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
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
