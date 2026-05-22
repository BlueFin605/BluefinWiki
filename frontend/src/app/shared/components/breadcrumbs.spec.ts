import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Breadcrumbs } from './breadcrumbs';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Breadcrumbs', () => {
  it('renders ancestor links and the current title', async () => {
    const { fixture } = await render(Breadcrumbs, {
      inputs: { guid: 'g1', currentTitle: 'Deep Page' },
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1/ancestors').flush({
      ancestors: [
        { guid: 'r', title: 'Root', parentGuid: null, status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: true },
        { guid: 'p', title: 'Parent', parentGuid: 'r', status: 'published', modifiedAt: '', modifiedBy: '', hasChildren: true },
      ],
    });
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('link', { name: 'Root' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parent' })).toBeInTheDocument();
    expect(screen.getByText('Deep Page')).toBeInTheDocument();
  });

  it('renders only the current title when there are no ancestors', async () => {
    const { fixture } = await render(Breadcrumbs, {
      inputs: { guid: 'g1', currentTitle: 'Root Page' },
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1/ancestors').flush({ ancestors: [] });
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('Root Page')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
