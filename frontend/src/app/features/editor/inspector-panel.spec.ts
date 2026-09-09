import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { InspectorPanel } from './inspector-panel';
import type { AttachmentUploader } from '../attachments/attachment-uploader';
import { Auth } from '../../core/auth/auth';
import type { PageMetadata } from '../pages/drafts';
import type { AuthUser } from '../../core/auth/auth.types';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function authStub(role: AuthUser['role']) {
  const user = signal<AuthUser | null>({
    userId: 'u',
    email: 'u@x',
    displayName: 'U',
    role,
    emailVerified: true,
  });
  return { provide: Auth, useValue: { user: user.asReadonly() } };
}

function meta(): PageMetadata {
  return {
    title: 'Hello',
    tags: [],
    status: 'draft',
    createdBy: 'u',
    modifiedBy: 'u',
    createdAt: '',
    modifiedAt: '',
    guid: 'g1',
  };
}

async function renderInspector(
  extraInputs: Record<string, unknown> = {},
  backlinkCount = 0,
  opts: { noopAnimations?: boolean } = {},
) {
  const result = await render(InspectorPanel, {
    inputs: { pageGuid: 'g1', metadata: meta(), pageAuthorId: 'u', ...extraInputs },
    providers: [
      opts.noopAnimations ? provideNoopAnimations() : provideAnimationsAsync(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      authStub('Admin'),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  // Each tab kicks off its own fetch when shown; the Properties tab fetches
  // page types eagerly on mount. The backlinks resource is also eager (the
  // panel needs its count for the tab badge).
  http.expectOne('/api/page-types').flush({ pageTypes: [] });
  http.expectOne('/api/tags?scope=_page').flush({ tags: [], scope: '_page' });
  http
    .expectOne('/api/pages/g1/backlinks')
    .flush({ guid: 'g1', backlinks: [], count: backlinkCount });
  await settle();
  return { ...result, http };
}

describe('InspectorPanel', () => {
  it('renders three tab labels', async () => {
    await renderInspector();
    expect(screen.getByRole('tab', { name: /properties/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /attachments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /linked/i })).toBeInTheDocument();
  });

  it('switching to attachments tab loads the attachments resource', async () => {
    const { http, fixture } = await renderInspector({}, 0, { noopAnimations: true });
    fixture.componentInstance['selectedTab'].set(1);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    http.expectOne('/api/pages/g1/attachments').flush({ attachments: [] });
  });

  it('keeps the Properties tab alive across a Properties→Attachments→Properties bounce — no page-types/page-tags refetch (Phase 4 review I8)', async () => {
    const { http, fixture } = await renderInspector({}, 0, { noopAnimations: true });

    // Properties → Attachments (first view of the Attachments tab).
    fixture.componentInstance['selectedTab'].set(1);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    http.expectOne('/api/pages/g1/attachments').flush({ attachments: [] });
    await settle();
    fixture.detectChanges();

    // Attachments → Properties. The Properties panels were kept alive by
    // *matTabContent, so no fresh rxResource is constructed and no GET repeats.
    fixture.componentInstance['selectedTab'].set(0);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    http.expectNone('/api/page-types');
    http.expectNone('/api/tags?scope=_page');
    http.verify();
  });

  it('routes the uploader uploaded event to the insertMarkdown output (step 4.9 auto-insert)', async () => {
    const { http, fixture } = await renderInspector({}, 0, { noopAnimations: true });
    fixture.componentInstance['selectedTab'].set(1);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    http.expectOne('/api/pages/g1/attachments').flush({ attachments: [] });
    await settle();
    fixture.detectChanges();

    const seen: string[] = [];
    fixture.componentInstance.insertMarkdown.subscribe((m) => seen.push(m));

    const uploader = fixture.debugElement.query(By.css('wiki-attachment-uploader'))
      .componentInstance as AttachmentUploader;
    uploader.uploaded.emit({ filename: 'x.png', markdown: '![x](x.png)' });

    // The exact markdown string is forwarded verbatim — no filename-only stash,
    // no re-derived markdown.
    expect(seen).toEqual(['![x](x.png)']);
  });

  it('shows the backlink count as a badge on the Linked tab when non-zero', async () => {
    await renderInspector({}, 3);
    const tab = screen.getByRole('tab', { name: /linked/i });
    const badge = tab.querySelector('.mat-badge');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('mat-badge-hidden')).toBe(false);
    expect(tab.querySelector('.mat-badge-content')?.textContent?.trim()).toBe('3');
    // The count must also reach assistive tech: the badge content span is
    // aria-hidden, so the tab's accessible name has to carry the number.
    expect(tab).toHaveAccessibleName('Linked, 3 backlinks');
  });

  it('hides the Linked tab badge when there are no backlinks (zero state)', async () => {
    await renderInspector({}, 0);
    const tab = screen.getByRole('tab', { name: /linked/i });
    const badge = tab.querySelector('.mat-badge');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('mat-badge-hidden')).toBe(true);
    // No count announced when there are none.
    expect(tab).toHaveAccessibleName('Linked');
  });

  it('switching to linked tab causes its own backlinks panel to mount + refetch', async () => {
    const { http, fixture } = await renderInspector({}, 0, { noopAnimations: true });
    fixture.componentInstance['selectedTab'].set(2);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    // The LinkedPagesPanel inside the tab has its own resource.
    http.expectOne('/api/pages/g1/backlinks').flush({ guid: 'g1', backlinks: [], count: 0 });
  });

  it('forwards the properties panel titleH1Sync output to the host', async () => {
    const { fixture } = await renderInspector();
    const seen: string[] = [];
    fixture.componentInstance.titleH1Sync.subscribe((t) => seen.push(t));

    const panel = fixture.debugElement
      .query(By.css('wiki-page-properties-panel'))
      .componentInstance as { titleH1Sync: { emit: (v: string) => void } };
    panel.titleH1Sync.emit('New Heading');

    expect(seen).toEqual(['New Heading']);
  });

  it('forwards the properties panel pageTypeChange output to the host', async () => {
    const { fixture } = await renderInspector();
    const seen: unknown[] = [];
    fixture.componentInstance.pageTypeChange.subscribe((c) => seen.push(c));

    const panel = fixture.debugElement
      .query(By.css('wiki-page-properties-panel'))
      .componentInstance as { pageTypeChange: { emit: (v: unknown) => void } };
    const payload = { pageType: 'pt-task', properties: { status: { type: 'string', value: 'x' } } };
    panel.pageTypeChange.emit(payload);

    expect(seen).toEqual([payload]);
  });
});
