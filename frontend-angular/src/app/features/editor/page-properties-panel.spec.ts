import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PagePropertiesPanel } from './page-properties-panel';
import type { PageMetadata } from '../pages/drafts';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function meta(over: Partial<PageMetadata> = {}): PageMetadata {
  return {
    title: 'My Page',
    tags: ['foo', 'bar'],
    status: 'draft',
    createdBy: 'u',
    modifiedBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
    guid: 'g1',
    ...over,
  };
}

async function renderPanel(initial: PageMetadata) {
  const result = await render(PagePropertiesPanel, {
    inputs: { metadata: initial },
    providers: [
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  // Drain the pageTypes fetch
  http.expectOne('/api/page-types').flush({ pageTypes: [] });
  await settle();
  result.fixture.detectChanges();
  return result;
}

describe('PagePropertiesPanel', () => {
  it('renders fields from metadata', async () => {
    await renderPanel(meta({ title: 'Hello' }));
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });

  it('renders the chip set for tags', async () => {
    await renderPanel(meta({ tags: ['alpha', 'beta'] }));
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('emits metadataChange when title is edited (debounced)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const result = await renderPanel(meta({ title: 'Old' }));
      const emissions: PageMetadata[] = [];
      result.fixture.componentInstance.metadataChange.subscribe((m) => emissions.push(m));

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const titleInput = screen.getByDisplayValue('Old');
      await user.clear(titleInput);
      await user.type(titleInput, 'New');

      // Advance past the 200ms debounce
      jest.advanceTimersByTime(250);
      await settle();

      expect(emissions.length).toBeGreaterThan(0);
      expect(emissions[emissions.length - 1].title).toBe('New');
    } finally {
      jest.useRealTimers();
    }
  });

  it('disables inputs when readOnly is true', async () => {
    const result = await render(PagePropertiesPanel, {
      inputs: { metadata: meta(), readOnly: true },
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    result.fixture.detectChanges();
    const titleInput = screen.getByDisplayValue('My Page');
    expect(titleInput).toBeDisabled();
  });

  it('renders read-only created/modified labels', async () => {
    await renderPanel(meta({ createdBy: 'alice', modifiedBy: 'bob' }));
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });
});
