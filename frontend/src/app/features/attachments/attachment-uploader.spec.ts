import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AttachmentUploader } from './attachment-uploader';
import { FILE_LIMITS, buildAttachmentMarkdown } from './attachment.types';
import type { AttachmentUploadedEvent } from './attachment.types';
import { InvalidationBus, attachmentsTag } from '../../core/api/invalidation';

function file(name: string, type: string, size: number): File {
  const f = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('AttachmentUploader', () => {
  it('renders the upload prompt', async () => {
    await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    expect(screen.getByText(/drop files/i)).toBeInTheDocument();
  });

  it('rejects an unsupported file with an error message', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const bad = file('weird.bin', 'application/x-octet', 100);
    await rendered.fixture.componentInstance.handleFiles([bad]);
    await settle();
    rendered.fixture.detectChanges();
    expect(screen.getByText(/not supported/i)).toBeInTheDocument();
  });

  it('rejects oversized images before any HTTP call', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const huge = file('huge.png', 'image/png', FILE_LIMITS.IMAGE.maxSize + 1);
    await rendered.fixture.componentInstance.handleFiles([huge]);
    await settle();
    rendered.fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(() => true);
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
  });

  async function driveUpload(
    componentInstance: AttachmentUploader,
    f: File,
    confirmBody: Record<string, unknown>,
  ): Promise<void> {
    const uploadPromise = componentInstance.handleFiles([f]);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/p1/attachments/presign').flush({
      uploadUrl: 'https://s3.example.com/x',
      attachmentKey: 'k',
      filename: f.name,
    });
    await settle();
    http.expectOne('https://s3.example.com/x').flush(null);
    await settle();
    http.expectOne('/api/pages/p1/attachments/confirm').flush(confirmBody);
    await uploadPromise;
    await settle();
  }

  it('emits uploaded with { filename, markdown } after a successful upload', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const events: AttachmentUploadedEvent[] = [];
    rendered.fixture.componentInstance.uploaded.subscribe((e) => events.push(e));

    await driveUpload(rendered.fixture.componentInstance, file('a.txt', 'text/plain', 100), {
      attachmentGuid: 'g',
      filename: 'a.txt',
      contentType: 'text/plain',
      size: 100,
      url: 'cdn',
    });

    expect(events).toEqual([
      { filename: 'a.txt', markdown: buildAttachmentMarkdown('a.txt', 'text/plain') },
    ]);
  });

  it('builds an image embed for the uploaded markdown via the shared builder', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const events: AttachmentUploadedEvent[] = [];
    rendered.fixture.componentInstance.uploaded.subscribe((e) => events.push(e));

    await driveUpload(rendered.fixture.componentInstance, file('Diagram.png', 'image/png', 10), {
      attachmentGuid: 'g',
      filename: 'Diagram.png',
      contentType: 'image/png',
      size: 10,
      url: 'cdn',
    });

    expect(events[0].markdown).toBe('![Diagram](Diagram.png)');
    expect(events[0].markdown).toBe(buildAttachmentMarkdown('Diagram.png', 'image/png'));
  });

  it('invalidates the page attachments tag on a successful upload', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const bus = TestBed.inject(InvalidationBus);
    const before = bus.version(attachmentsTag('p1'));

    await driveUpload(rendered.fixture.componentInstance, file('a.txt', 'text/plain', 100), {
      attachmentGuid: 'g',
      filename: 'a.txt',
      contentType: 'text/plain',
      size: 100,
      url: 'cdn',
    });

    expect(bus.version(attachmentsTag('p1'))).toBe(before + 1);
  });

  it('shows a failed upload inline and does not emit uploaded (no auto-insert)', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const events: AttachmentUploadedEvent[] = [];
    rendered.fixture.componentInstance.uploaded.subscribe((e) => events.push(e));

    const uploadPromise = rendered.fixture.componentInstance.handleFiles([
      file('a.txt', 'text/plain', 100),
    ]);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/pages/p1/attachments/presign')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await uploadPromise;
    await settle();
    rendered.fixture.detectChanges();

    expect(rendered.container.querySelector('.errors')?.textContent).toMatch(/a\.txt/);
    expect(events).toEqual([]);
  });
});
