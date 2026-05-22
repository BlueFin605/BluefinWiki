import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AttachmentManager } from './attachment-manager';
import { Auth } from '../../core/auth/auth';
import type { AttachmentMetadata } from './attachment.types';
import type { AuthUser } from '../../core/auth/auth.types';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function authStub(role: AuthUser['role'], userId = 'u-current') {
  const user = signal<AuthUser | null>({
    userId,
    email: 'u@x',
    displayName: 'U',
    role,
    emailVerified: true,
  });
  return {
    provide: Auth,
    useValue: { user: user.asReadonly() },
  };
}

function meta(over: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    filename: 'doc.pdf',
    contentType: 'application/pdf',
    size: 1024,
    uploadedAt: '2026-01-01T00:00:00Z',
    uploadedBy: 'u-current',
    ...over,
  };
}

describe('AttachmentManager', () => {
  it('renders the attachments list', async () => {
    const { fixture } = await render(AttachmentManager, {
      inputs: { pageGuid: 'p1', pageAuthorId: 'u-current' },
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        authStub('Admin'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'first.pdf' }), meta({ filename: 'second.png', contentType: 'image/png' })],
    });
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('first.pdf')).toBeInTheDocument();
    expect(screen.getByText('second.png')).toBeInTheDocument();
  });

  it('emits insertMarkdown with the right text for an image', async () => {
    const rendered = await render(AttachmentManager, {
      inputs: { pageGuid: 'p1', pageAuthorId: 'u-current' },
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        authStub('Admin'),
      ],
    });
    const inserts: string[] = [];
    rendered.fixture.componentInstance.insertMarkdown.subscribe((s) => inserts.push(s));
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'pic.png', contentType: 'image/png' })],
    });
    await settle();
    rendered.fixture.detectChanges();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /insert/i }));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatch(/^!\[pic\.png\]\(.*pic\.png\)$/);
  });

  it('sends DELETE when an admin clicks delete', async () => {
    const rendered = await render(AttachmentManager, {
      inputs: { pageGuid: 'p1', pageAuthorId: 'u-other' },
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        authStub('Admin'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'doc.pdf' })],
    });
    await settle();
    rendered.fixture.detectChanges();
    const user = userEvent.setup();
    // Bypass the window.confirm prompt
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await user.click(screen.getByRole('button', { name: /delete/i }));
      const del = http.expectOne('/api/pages/p1/attachments/doc.pdf');
      expect(del.request.method).toBe('DELETE');
      del.flush(null);
      await settle();
      // After delete the list refetches
      http.expectOne('/api/pages/p1/attachments').flush({ attachments: [] });
      await settle();
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('hides delete for non-admin non-author users', async () => {
    const { fixture } = await render(AttachmentManager, {
      inputs: { pageGuid: 'p1', pageAuthorId: 'u-other' },
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideHttpClientTesting(),
        authStub('Standard', 'u-different'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'doc.pdf' })],
    });
    await settle();
    fixture.detectChanges();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});
