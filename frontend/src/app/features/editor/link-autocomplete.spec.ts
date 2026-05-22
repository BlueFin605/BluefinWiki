import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LinkAutocomplete } from './link-autocomplete';
import type { PageSearchResult } from '../pages/pages';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function debouncePass(): Promise<void> {
  // The debounceTime is 200ms; advance fake timers + flush microtasks.
  jest.advanceTimersByTime(250);
  await settle();
}

function configureFakeTimers(): void {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
}

async function renderAuto() {
  const rendered = await render(LinkAutocomplete, {
    inputs: {
      query: 'foo',
      position: { top: 100, left: 50 },
      visible: true,
    },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const picks: PageSearchResult[] = [];
  const counter = { dismisses: 0 };
  rendered.fixture.componentInstance.pick.subscribe((p) => picks.push(p));
  rendered.fixture.componentInstance.dismiss.subscribe(() => { counter.dismisses += 1; });
  const http = TestBed.inject(HttpTestingController);
  return {
    picks,
    counter,
    flush(results: PageSearchResult[]): void {
      const req = http.expectOne((r) => r.url.startsWith('/api/pages/search'));
      req.flush({ results });
    },
    http,
    fixture: rendered.fixture,
  };
}

describe('LinkAutocomplete', () => {
  beforeEach(() => configureFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders results from the page-search resource', async () => {
    const auto = await renderAuto();
    await debouncePass();
    auto.flush([
      { guid: 'g1', title: 'Foo One', path: '/foo-one', folderId: null },
      { guid: 'g2', title: 'Foo Two', path: '/foo-two', folderId: null },
    ]);
    await settle();
    auto.fixture.detectChanges();
    expect(screen.getByText('Foo One')).toBeInTheDocument();
    expect(screen.getByText('Foo Two')).toBeInTheDocument();
  });

  it('ArrowDown moves the selection then Enter picks the highlighted item', async () => {
    const auto = await renderAuto();
    await debouncePass();
    auto.flush([
      { guid: 'g1', title: 'A', path: '/a', folderId: null },
      { guid: 'g2', title: 'B', path: '/b', folderId: null },
    ]);
    await settle();
    auto.fixture.detectChanges();

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(auto.picks.length).toBe(1);
    expect(auto.picks[0].guid).toBe('g2');
  });

  it('Escape emits dismiss', async () => {
    const auto = await renderAuto();
    await debouncePass();
    auto.flush([{ guid: 'g1', title: 'A', path: '/a', folderId: null }]);
    await settle();
    auto.fixture.detectChanges();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(auto.counter.dismisses).toBe(1);
  });

  it('clicking an item picks it', async () => {
    const auto = await renderAuto();
    await debouncePass();
    auto.flush([
      { guid: 'g1', title: 'Click Me', path: '/c', folderId: null },
    ]);
    await settle();
    auto.fixture.detectChanges();
    fireEvent.click(screen.getByText('Click Me'));
    expect(auto.picks[0].guid).toBe('g1');
  });
});
