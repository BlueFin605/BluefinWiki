import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LinkedPagesPanel } from './linked-pages-panel';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('LinkedPagesPanel', () => {
  it('renders backlinks from the resource', async () => {
    const { fixture } = await render(LinkedPagesPanel, {
      inputs: { pageGuid: 'g1' },
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1/backlinks').flush({
      guid: 'g1',
      backlinks: [
        { guid: 'b1', title: 'First Backlink' },
        { guid: 'b2', title: 'Second Backlink' },
      ],
      count: 2,
    });
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('First Backlink')).toBeInTheDocument();
    expect(screen.getByText('Second Backlink')).toBeInTheDocument();
  });

  it('shows an empty-state when there are no backlinks', async () => {
    const { fixture } = await render(LinkedPagesPanel, {
      inputs: { pageGuid: 'g1' },
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1/backlinks').flush({ guid: 'g1', backlinks: [], count: 0 });
    await settle();
    fixture.detectChanges();
    expect(screen.getByText(/no backlinks/i)).toBeInTheDocument();
  });

  it('exposes a count signal matching the backlinks length', async () => {
    const { fixture } = await render(LinkedPagesPanel, {
      inputs: { pageGuid: 'g1' },
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/g1/backlinks').flush({
      guid: 'g1',
      backlinks: [{ guid: 'b1', title: 'One' }],
      count: 1,
    });
    await settle();
    fixture.detectChanges();
    expect(fixture.componentInstance.count()).toBe(1);
  });
});
