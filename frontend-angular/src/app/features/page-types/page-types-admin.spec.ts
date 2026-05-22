import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PageTypesAdmin } from './page-types-admin';
import type { PageTypeDefinition } from '../pages/page.types';

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt-1',
    name: 'Article',
    icon: 'A',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: true,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function flushDialog(): Promise<void> {
  // Material dialog close animation defaults to ~150ms even with noop
  // animations in some test setups; wait it out so afterClosed fires.
  await new Promise((r) => setTimeout(r, 200));
  await settle();
}

function providers() {
  return [
    provideAnimationsAsync(),
    provideRouter([]),
    provideHttpClient(),
    provideHttpClientTesting(),
  ];
}

describe('PageTypesAdmin', () => {
  it('renders existing page types in the list', async () => {
    await render(PageTypesAdmin, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/page-types').flush({
      pageTypes: [
        pageType({ guid: 'a', name: 'Article' }),
        pageType({ guid: 'b', name: 'Note' }),
      ],
    });
    await settle();
    expect(screen.getByText('Article')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('selecting a row populates the editor form', async () => {
    const { fixture } = await render(PageTypesAdmin, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/page-types').flush({
      pageTypes: [pageType({ guid: 'a', name: 'Article', icon: 'X' })],
    });
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit article/i }));
    await settle();
    fixture.detectChanges();
    const nameInput = screen.getByLabelText(/^name/i);
    expect((nameInput as HTMLInputElement).value).toBe('Article');
    const iconInput = screen.getByLabelText(/^icon/i);
    expect((iconInput as HTMLInputElement).value).toBe('X');
  });

  it('the "New page type" button clears the editor form', async () => {
    const { fixture } = await render(PageTypesAdmin, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/page-types').flush({
      pageTypes: [pageType({ guid: 'a', name: 'Article', icon: 'X' })],
    });
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit article/i }));
    await settle();
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /new page type/i }));
    await settle();
    fixture.detectChanges();
    const nameInput = screen.getByLabelText(/^name/i);
    expect((nameInput as HTMLInputElement).value).toBe('');
  });

  it('Save (new) POSTs to /api/page-types', async () => {
    const { fixture } = await render(PageTypesAdmin, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /new page type/i }));
    await settle();
    fixture.detectChanges();

    const nameInput = screen.getByLabelText(/^name/i);
    await user.type(nameInput, 'Recipe');
    const iconInput = screen.getByLabelText(/^icon/i);
    await user.clear(iconInput);
    await user.type(iconInput, 'R');
    await settle();

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await settle();
    const post = http.expectOne('/api/page-types');
    expect(post.request.method).toBe('POST');
    const body = post.request.body as { name: string; icon: string };
    expect(body.name).toBe('Recipe');
    expect(body.icon).toBe('R');
    post.flush(pageType({ guid: 'r-1', name: 'Recipe', icon: 'R' }));
    await settle();
    // bumpVersion triggers refetch
    http.expectOne('/api/page-types').flush({
      pageTypes: [pageType({ guid: 'r-1', name: 'Recipe', icon: 'R' })],
    });
    await settle();
  });

  it('Save (existing) PUTs to /api/page-types/{guid}', async () => {
    const { fixture } = await render(PageTypesAdmin, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/page-types').flush({
      pageTypes: [pageType({ guid: 'pt-9', name: 'Article', icon: 'A' })],
    });
    await settle();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit article/i }));
    await settle();
    fixture.detectChanges();

    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed');
    await settle();

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await settle();
    const put = http.expectOne('/api/page-types/pt-9');
    expect(put.request.method).toBe('PUT');
    const body = put.request.body as { name: string };
    expect(body.name).toBe('Renamed');
    put.flush(pageType({ guid: 'pt-9', name: 'Renamed', icon: 'A' }));
    await settle();
    http.expectOne('/api/page-types').flush({
      pageTypes: [pageType({ guid: 'pt-9', name: 'Renamed', icon: 'A' })],
    });
    await settle();
  });

  it('Delete prompts a confirm dialog and on confirm sends DELETE', async () => {
    const { fixture } = await render(PageTypesAdmin, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('/api/page-types').flush({
      pageTypes: [pageType({ guid: 'pt-del', name: 'Goner' })],
    });
    await settle();
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete goner/i }));
    await settle();
    fixture.detectChanges();

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    await flushDialog();

    const del = http.expectOne('/api/page-types/pt-del');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await settle();
    http.expectOne('/api/page-types').flush({ pageTypes: [] });
    await settle();
  });
});
