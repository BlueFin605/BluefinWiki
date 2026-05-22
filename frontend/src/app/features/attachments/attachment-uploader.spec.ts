import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AttachmentUploader } from './attachment-uploader';
import { FILE_LIMITS } from './attachment.types';
import type { AttachmentUploadResponse } from './attachment.types';

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

  it('emits uploaded with the response after a successful upload', async () => {
    const rendered = await render(AttachmentUploader, {
      inputs: { pageGuid: 'p1' },
      providers: [provideAnimationsAsync(), provideHttpClient(), provideHttpClientTesting()],
    });
    const responses: AttachmentUploadResponse[] = [];
    rendered.fixture.componentInstance.uploaded.subscribe((r) => responses.push(r));

    const small = file('a.txt', 'text/plain', 100);
    const uploadPromise = rendered.fixture.componentInstance.handleFiles([small]);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/pages/p1/attachments/presign').flush({
      uploadUrl: 'https://s3.example.com/x',
      attachmentKey: 'k',
      filename: 'a.txt',
    });
    await settle();
    http.expectOne('https://s3.example.com/x').flush(null);
    await settle();
    http.expectOne('/api/pages/p1/attachments/confirm').flush({
      attachmentGuid: 'g',
      filename: 'a.txt',
      contentType: 'text/plain',
      size: 100,
      url: 'cdn',
    });
    await uploadPromise;
    await settle();

    expect(responses.length).toBe(1);
    expect(responses[0].filename).toBe('a.txt');
  });
});
