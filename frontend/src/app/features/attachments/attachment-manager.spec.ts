import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { defer, of, throwError, type Observable } from 'rxjs';
import { AttachmentManager } from './attachment-manager';
import { AttachmentLightbox } from './attachment-lightbox';
import { Attachments } from './attachments';
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

// --- HTTP-backed rendering (real Attachments service) -----------------------

async function renderHttp(
  inputs: Record<string, unknown>,
  auth = authStub('Admin'),
) {
  const rendered = await render(AttachmentManager, {
    inputs,
    providers: [
      provideAnimationsAsync(),
      provideHttpClient(),
      provideHttpClientTesting(),
      auth,
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  return { ...rendered, http };
}

// --- Stub-backed rendering (deterministic list-load, fake timers) ----------

interface AttachmentsStub {
  listAttachments: jest.Mock;
  getAttachmentUrl: jest.Mock;
  deleteAttachment: jest.Mock;
}

function attachmentsStub(over: Partial<AttachmentsStub> = {}): AttachmentsStub {
  return {
    listAttachments: jest.fn(() => of<AttachmentMetadata[]>([])),
    getAttachmentUrl: jest.fn(() => Promise.resolve('https://s3.test/presigned')),
    deleteAttachment: jest.fn(() => Promise.resolve()),
    ...over,
  };
}

/**
 * A `listAttachments` implementation whose returned observable is COLD — each
 * subscription (the initial load and every backoff retry) re-runs the producer,
 * mirroring a real `HttpClient.get`. `subs()` reports how many subscriptions
 * (i.e. load attempts) have happened; `outcome` decides per-attempt what the
 * observable does.
 */
function coldList(
  outcome: (attempt: number) => Observable<AttachmentMetadata[]>,
): { list: jest.Mock; subs: () => number } {
  let n = 0;
  const list = jest.fn(() =>
    defer(() => {
      n += 1;
      return outcome(n);
    }),
  );
  return { list, subs: () => n };
}

const boom = (): Observable<AttachmentMetadata[]> => throwError(() => new Error('boom'));

async function renderStub(stub: AttachmentsStub, auth = authStub('Admin')) {
  return render(AttachmentManager, {
    inputs: { pageGuid: 'p1' },
    providers: [
      provideAnimationsAsync(),
      { provide: Attachments, useValue: stub },
      auth,
    ],
  });
}

describe('AttachmentManager — list + row actions', () => {
  it('renders the attachments list', async () => {
    const { fixture, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'first.pdf' }), meta({ filename: 'second.png', contentType: 'image/png' })],
    });
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('first.pdf')).toBeInTheDocument();
    expect(screen.getByText('second.png')).toBeInTheDocument();
  });

  it('sorts the list newest-first by upload date', async () => {
    const { fixture, container, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [
        meta({ filename: 'oldest.pdf', uploadedAt: '2026-01-01T00:00:00Z' }),
        meta({ filename: 'newest.pdf', uploadedAt: '2026-03-01T00:00:00Z' }),
        meta({ filename: 'middle.pdf', uploadedAt: '2026-02-01T00:00:00Z' }),
      ],
    });
    await settle();
    fixture.detectChanges();
    const names = Array.from(container.querySelectorAll('.name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['newest.pdf', 'middle.pdf', 'oldest.pdf']);
  });

  it('shows the type emoji on every row, plus a wiki-image thumbnail on image rows', async () => {
    const { fixture, container, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [
        meta({ filename: 'pic.png', contentType: 'image/png', size: 2048, uploadedAt: '2026-05-02T00:00:00Z' }),
        meta({ filename: 'report.pdf', contentType: 'application/pdf', size: 4096, uploadedAt: '2026-05-01T00:00:00Z' }),
      ],
    });
    await settle();
    fixture.detectChanges();
    const rows = Array.from(container.querySelectorAll('li.row'));
    expect(rows).toHaveLength(2);

    const imageRow = rows.find((r) => r.textContent?.includes('pic.png'))!;
    const docRow = rows.find((r) => r.textContent?.includes('report.pdf'))!;

    // Emoji is present on BOTH rows (image + non-image).
    expect(imageRow.querySelector('.emoji')?.textContent?.trim()).toBe('🖼️');
    expect(docRow.querySelector('.emoji')?.textContent?.trim()).toBe('📄');

    // Thumbnail is additional, image rows only.
    expect(container.querySelectorAll('wiki-image')).toHaveLength(1);
    expect(imageRow.querySelector('wiki-image')).not.toBeNull();
    expect(docRow.querySelector('wiki-image')).toBeNull();

    // Each row shows filename + size + uploaded date (React ref line 415). The
    // date goes through Angular's DatePipe (`medium`), so it renders in the
    // viewer's locale — never the raw ISO string. Locale-independent checks:
    // the ISO is gone and the cell still carries the year.
    expect(imageRow.querySelector('.name')?.textContent?.trim()).toBe('pic.png');
    expect(imageRow.querySelector('.size')?.textContent?.trim()).toBe('2 KB');
    const imageDate = imageRow.querySelector('.date')?.textContent?.trim() ?? '';
    expect(imageDate).not.toBe('2026-05-02T00:00:00Z');
    expect(imageDate).toContain('2026');
    expect(docRow.querySelector('.size')?.textContent?.trim()).toBe('4 KB');
    const docDate = docRow.querySelector('.date')?.textContent?.trim() ?? '';
    expect(docDate).not.toBe('2026-05-01T00:00:00Z');
    expect(docDate).toContain('2026');
  });

  it('emits insertMarkdown via the shared builder (image embed form)', async () => {
    const rendered = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
    const inserts: string[] = [];
    rendered.fixture.componentInstance.insertMarkdown.subscribe((s) => inserts.push(s));
    rendered.http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'pic.png', contentType: 'image/png' })],
    });
    await settle();
    rendered.fixture.detectChanges();
    await userEvent.setup().click(screen.getByRole('button', { name: /insert into page/i }));
    expect(inserts).toEqual(['![pic](pic.png)']);
  });

  it('Copy Markdown writes the shared markdown string to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const { fixture, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
      http.expectOne('/api/pages/p1/attachments').flush({
        attachments: [meta({ filename: 'pic.png', contentType: 'image/png' })],
      });
      await settle();
      fixture.detectChanges();
      // fireEvent, not userEvent: userEvent.setup() installs its own clipboard stub.
      fireEvent.click(screen.getByRole('button', { name: /copy markdown/i }));
      await settle();
      expect(writeText).toHaveBeenCalledWith('![pic](pic.png)');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('Download resolves the presigned URL and triggers an anchor download', async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    try {
      const { fixture, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
      http.expectOne('/api/pages/p1/attachments').flush({
        attachments: [meta({ filename: 'report.pdf' })],
      });
      await settle();
      fixture.detectChanges();
      await userEvent.setup().click(screen.getByRole('button', { name: /download/i }));
      const presign = http.expectOne('/api/pages/p1/attachments/report.pdf');
      expect(presign.request.method).toBe('GET');
      presign.flush({ url: 'https://s3.test/report.pdf?sig' });
      await settle();
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('Drag Link sets the attachment markdown as drag data', async () => {
    const { fixture, container, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'pic.png', contentType: 'image/png' })],
    });
    await settle();
    fixture.detectChanges();

    const row = container.querySelector('li.row[draggable="true"]');
    expect(row).not.toBeNull();
    const setData = jest.fn();
    const dataTransfer = { setData, effectAllowed: 'none' } as unknown as DataTransfer;
    const event = new Event('dragstart', { bubbles: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    row!.dispatchEvent(event);
    expect(setData).toHaveBeenCalledWith('text/plain', '![pic](pic.png)');
  });

  it('opens a full-screen lightbox when the thumbnail is clicked', async () => {
    const { fixture, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-current' });
    const dialog = TestBed.inject(MatDialog);
    const openSpy = jest
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as never);
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'pic.png', contentType: 'image/png' })],
    });
    await settle();
    fixture.detectChanges();
    await userEvent.setup().click(screen.getByRole('button', { name: /preview image/i }));
    expect(openSpy).toHaveBeenCalledWith(
      AttachmentLightbox,
      expect.objectContaining({ data: { pageGuid: 'p1', filename: 'pic.png' } }),
    );
  });

  it('sends DELETE when an admin confirms delete', async () => {
    const { fixture, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-other' });
    http.expectOne('/api/pages/p1/attachments').flush({ attachments: [meta({ filename: 'doc.pdf' })] });
    await settle();
    fixture.detectChanges();

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /delete attachment/i }));
      const del = http.expectOne('/api/pages/p1/attachments/doc.pdf');
      expect(del.request.method).toBe('DELETE');
      del.flush(null);
      await settle();
      http.expectOne('/api/pages/p1/attachments').flush({ attachments: [] });
      await settle();
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('does not send DELETE when the confirm prompt is dismissed', async () => {
    const { fixture, http } = await renderHttp({ pageGuid: 'p1', pageAuthorId: 'u-other' });
    http.expectOne('/api/pages/p1/attachments').flush({ attachments: [meta({ filename: 'doc.pdf' })] });
    await settle();
    fixture.detectChanges();

    const originalConfirm = window.confirm;
    window.confirm = () => false;
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: /delete attachment/i }));
      http.expectNone('/api/pages/p1/attachments/doc.pdf');
    } finally {
      window.confirm = originalConfirm;
    }
  });

  it('hides delete for non-admin non-author non-uploader users', async () => {
    const { fixture, http } = await renderHttp(
      { pageGuid: 'p1', pageAuthorId: 'u-other' },
      authStub('Standard', 'u-different'),
    );
    http.expectOne('/api/pages/p1/attachments').flush({
      attachments: [meta({ filename: 'doc.pdf', uploadedBy: 'someone-else' })],
    });
    await settle();
    fixture.detectChanges();
    expect(screen.queryByRole('button', { name: /delete attachment/i })).toBeNull();
  });
});

describe('AttachmentManager — list-load backoff', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }));
  afterEach(() => jest.useRealTimers());

  it('retries a failed list load with exponential backoff, 10 total attempts then gives up', async () => {
    const { list, subs } = coldList(boom);
    const { fixture } = await renderStub(attachmentsStub({ listAttachments: list }));
    await settle();
    expect(subs()).toBe(1); // initial load attempt

    // Backoff delays before retries 1..9: 1s, 2s, 4s, 8s, 16s, then 30s x4.
    const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000];
    for (let i = 0; i < delays.length; i++) {
      jest.advanceTimersByTime(delays[i] - 1);
      await settle();
      expect(subs()).toBe(i + 1); // retry not fired yet — 1ms short
      jest.advanceTimersByTime(1);
      await settle();
      expect(subs()).toBe(i + 2); // retry i+1 fired exactly on the delay
    }
    expect(subs()).toBe(10); // 1 initial + 9 retries

    fixture.detectChanges();
    expect(screen.getByText(/failed to load attachments/i)).toBeInTheDocument();

    // Given up: no further retries however long we wait.
    jest.advanceTimersByTime(120_000);
    await settle();
    expect(subs()).toBe(10);
  });

  it('Refresh forces an immediate retry and resets the backoff to 1s', async () => {
    const { list, subs } = coldList(boom);
    const { fixture } = await renderStub(attachmentsStub({ listAttachments: list }));
    await settle();
    expect(subs()).toBe(1);

    // Grow the backoff: fire retry #1 (after 1s) and retry #2 (after 2s).
    jest.advanceTimersByTime(1000);
    await settle();
    jest.advanceTimersByTime(2000);
    await settle();
    expect(subs()).toBe(3);
    // The next automatic retry would now be 4s away.

    fireEvent.click(screen.getByRole('button', { name: /refresh attachments/i }));
    await settle();
    expect(subs()).toBe(4); // immediate, not 4s later
    expect(list).toHaveBeenCalledTimes(2); // switchMap re-invoked the list call

    // Backoff was reset: the next retry is 1s away again, not 4s/8s.
    jest.advanceTimersByTime(999);
    await settle();
    expect(subs()).toBe(4);
    jest.advanceTimersByTime(1);
    await settle();
    expect(subs()).toBe(5);

    fixture.detectChanges();
  });

  it('Refresh re-runs the list load and can recover from an error', async () => {
    const { list } = coldList((attempt) =>
      attempt === 1 ? boom() : of([meta({ filename: 'recovered.pdf' })]),
    );
    const { fixture } = await renderStub(attachmentsStub({ listAttachments: list }));
    await settle();
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: /refresh attachments/i }));
    await settle();
    fixture.detectChanges();
    expect(screen.getByText('recovered.pdf')).toBeInTheDocument();
  });

  it('renders a successful list without any retry', async () => {
    const { list, subs } = coldList(() =>
      of([meta({ filename: 'a.pdf' }), meta({ filename: 'b.pdf' })]),
    );
    const { fixture } = await renderStub(attachmentsStub({ listAttachments: list }));
    await settle();
    fixture.detectChanges();
    expect(subs()).toBe(1);
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
  });
});
