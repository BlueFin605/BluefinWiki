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

/** The click-to-edit Title trigger (shown when not editing). */
function titleTrigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Title' });
}

describe('PagePropertiesPanel', () => {
  it('renders the title as a click-to-edit trigger showing the current value', async () => {
    await renderPanel(meta({ title: 'Hello' }));
    expect(titleTrigger()).toHaveTextContent('Hello');
    // Not an input until clicked.
    expect(screen.queryByDisplayValue('Hello')).toBeNull();
  });

  it('renders the chip set for tags', async () => {
    await renderPanel(meta({ tags: ['alpha', 'beta'] }));
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('click-to-edit swaps the trigger for a focused input and selects its text', async () => {
    const selectSpy = jest.spyOn(HTMLInputElement.prototype, 'select');
    try {
      const result = await renderPanel(meta({ title: 'Hello' }));
      await userEvent.click(titleTrigger());
      result.fixture.detectChanges();
      await settle();

      const input = screen.getByDisplayValue('Hello');
      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
      // Text is selected on entry (jsdom collapses the range on a later value
      // write, so assert the call rather than the resulting selection).
      expect(selectSpy).toHaveBeenCalled();
      // Trigger is gone while editing.
      expect(screen.queryByRole('button', { name: 'Title' })).toBeNull();
    } finally {
      selectSpy.mockRestore();
    }
  });

  it('emits metadataChange when title is edited (debounced)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const result = await renderPanel(meta({ title: 'Old' }));
      const emissions: PageMetadata[] = [];
      result.fixture.componentInstance.metadataChange.subscribe((m) => emissions.push(m));

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.click(titleTrigger());
      result.fixture.detectChanges();
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

  it('emits titleH1Sync exactly once per debounce window (no sync loop)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const result = await renderPanel(meta({ title: 'Old' }));
      const syncs: string[] = [];
      result.fixture.componentInstance.titleH1Sync.subscribe((t) => syncs.push(t));

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.click(titleTrigger());
      result.fixture.detectChanges();
      const titleInput = screen.getByDisplayValue('Old');
      await user.type(titleInput, 'X');

      jest.advanceTimersByTime(250);
      await settle();

      expect(syncs).toEqual(['OldX']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not emit titleH1Sync for a programmatic metadata change (hydration)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const result = await renderPanel(meta({ title: 'Old' }));
      const syncs: string[] = [];
      result.fixture.componentInstance.titleH1Sync.subscribe((t) => syncs.push(t));

      await result.rerender({ inputs: { metadata: meta({ title: 'Server Renamed' }) } });
      jest.advanceTimersByTime(250);
      await settle();

      expect(syncs).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reverts a blank title on blur and never emits an empty metadataChange', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    try {
      const result = await renderPanel(meta({ title: 'Keep Me' }));
      const emissions: PageMetadata[] = [];
      result.fixture.componentInstance.metadataChange.subscribe((m) => emissions.push(m));

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.click(titleTrigger());
      result.fixture.detectChanges();
      const titleInput = screen.getByDisplayValue('Keep Me');
      await user.clear(titleInput);
      await user.type(titleInput, '   ');
      jest.advanceTimersByTime(250);
      await settle();

      // Debounce fired while blank -> nothing persisted.
      expect(emissions.every((m) => m.title.trim() !== '')).toBe(true);

      titleInput.blur();
      jest.advanceTimersByTime(250);
      await settle();
      result.fixture.detectChanges();

      // Reverted to the prior value, shown again on the click-to-edit trigger.
      expect(titleTrigger()).toHaveTextContent('Keep Me');
      expect(emissions.every((m) => m.title.trim() !== '')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('disables the title trigger when readOnly is true', async () => {
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
    expect(titleTrigger()).toBeDisabled();
  });

  it('renders read-only created/modified labels', async () => {
    await renderPanel(meta({ createdBy: 'alice', modifiedBy: 'bob' }));
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });
});
