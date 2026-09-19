import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { RebuildPageIndex } from './rebuild-page-index';
import type { RebuildResult } from './admin-tasks';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function providers() {
  return [
    provideNoopAnimations(),
    provideRouter([]),
    provideHttpClient(),
    provideHttpClientTesting(),
  ];
}

describe('RebuildPageIndex', () => {
  it('clicking "Rebuild now" reveals an inline confirm block without calling the endpoint', async () => {
    const { fixture } = await render(RebuildPageIndex, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rebuild now/i }));
    fixture.detectChanges();
    expect(screen.getByText(/scan the entire pages bucket/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, rebuild/i })).toBeInTheDocument();
    http.expectNone('/api/admin/rebuild-page-index');
  });

  it('cancelling the confirm block aborts the rebuild', async () => {
    const { fixture } = await render(RebuildPageIndex, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rebuild now/i }));
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    fixture.detectChanges();
    expect(screen.queryByText(/scan the entire pages bucket/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rebuild now/i })).toBeInTheDocument();
    http.expectNone('/api/admin/rebuild-page-index');
  });

  it('confirming ("Yes, rebuild") calls POST /api/admin/rebuild-page-index', async () => {
    const { fixture } = await render(RebuildPageIndex, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rebuild now/i }));
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /yes, rebuild/i }));
    await settle();
    fixture.detectChanges();
    const post = http.expectOne('/api/admin/rebuild-page-index');
    expect(post.request.method).toBe('POST');
    post.flush({
      totalPages: 0,
      indexed: 0,
      failed: 0,
      errors: [],
      durationMs: 100,
      deletedOrphans: 0,
      orphanGuids: [],
    } satisfies RebuildResult);
    await settle();
  });

  it('displays the result after a successful rebuild, including a collapsible orphan-GUID list', async () => {
    const { fixture } = await render(RebuildPageIndex, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rebuild now/i }));
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /yes, rebuild/i }));
    await settle();
    fixture.detectChanges();
    const post = http.expectOne('/api/admin/rebuild-page-index');
    post.flush({
      totalPages: 42,
      indexed: 41,
      failed: 1,
      errors: ['oops'],
      durationMs: 5000,
      deletedOrphans: 2,
      orphanGuids: ['guid-1', 'guid-2'],
    } satisfies RebuildResult);
    await settle();
    fixture.detectChanges();
    expect(screen.getByRole('heading', { name: /rebuild complete/i })).toBeInTheDocument();
    expect(screen.getByText('Pages discovered').nextElementSibling?.textContent).toContain('42');
    expect(screen.getByText('Rows written').nextElementSibling?.textContent).toContain('41');
    expect(screen.getByText(/2 deleted orphan guid/i)).toBeInTheDocument();
    expect(screen.getByText('guid-1')).toBeInTheDocument();
    expect(screen.getByText('guid-2')).toBeInTheDocument();
  });

  it('shows an error snackbar when the rebuild fails', async () => {
    const { fixture } = await render(RebuildPageIndex, { providers: providers() });
    const http = TestBed.inject(HttpTestingController);
    const snack = TestBed.inject(MatSnackBar);
    const openSpy = jest.spyOn(snack, 'open');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /rebuild now/i }));
    fixture.detectChanges();
    await user.click(screen.getByRole('button', { name: /yes, rebuild/i }));
    await settle();
    fixture.detectChanges();
    const post = http.expectOne('/api/admin/rebuild-page-index');
    post.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();
    fixture.detectChanges();
    expect(openSpy).toHaveBeenCalled();
  });

  it('keeps a visible title and a back-to-pages affordance (global toolbar removed)', async () => {
    await render(RebuildPageIndex, { providers: providers() });
    expect(screen.getByRole('heading', { level: 1, name: /rebuild page index/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to pages/i })).toBeInTheDocument();
  });
});
