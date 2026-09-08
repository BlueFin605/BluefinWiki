import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Attachments } from './attachments';
import type { AttachmentMetadata, AttachmentUploadResponse } from './attachment.types';
import { FILE_LIMITS } from './attachment.types';

function file(name: string, type: string, size: number): File {
  const f = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function meta(over: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    filename: 'doc.pdf',
    contentType: 'application/pdf',
    size: 1024,
    uploadedAt: '2026-01-01T00:00:00Z',
    uploadedBy: 'u',
    ...over,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('Attachments service', () => {
  let http: HttpTestingController;
  let attachments: Attachments;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Attachments],
    });
    http = TestBed.inject(HttpTestingController);
    attachments = TestBed.inject(Attachments);
  });

  afterEach(() => http.verify());

  describe('uploadFile', () => {
    it('posts the right presign + S3 PUT + confirm sequence', async () => {
      const f = file('photo.jpg', 'image/jpeg', 2048);
      const uploadPromise = attachments.uploadFile('page-1', f);

      // 1. presign
      const presignReq = http.expectOne('/api/pages/page-1/attachments/presign');
      expect(presignReq.request.method).toBe('POST');
      expect(presignReq.request.body).toEqual({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 2048,
      });
      presignReq.flush({
        uploadUrl: 'https://s3.example.com/bucket/photo.jpg?signed',
        attachmentKey: 'page-1/photo.jpg',
        filename: 'photo.jpg',
      });

      // 2. S3 PUT to absolute URL (interceptor bypassed)
      await settle();
      const s3Req = http.expectOne('https://s3.example.com/bucket/photo.jpg?signed');
      expect(s3Req.request.method).toBe('PUT');
      expect(s3Req.request.headers.get('Content-Type')).toBe('image/jpeg');
      s3Req.flush(null);

      // 3. confirm
      await settle();
      const confirmReq = http.expectOne('/api/pages/page-1/attachments/confirm');
      expect(confirmReq.request.method).toBe('POST');
      expect(confirmReq.request.body).toEqual({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 2048,
        attachmentKey: 'page-1/photo.jpg',
      });
      const response: AttachmentUploadResponse = {
        attachmentGuid: 'att-1',
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 2048,
        url: 'https://cdn.example.com/photo.jpg',
      };
      confirmReq.flush(response);

      const result = await uploadPromise;
      expect(result).toEqual(response);
    });

    it('rejects oversized images before any HTTP call', async () => {
      const huge = file('huge.png', 'image/png', FILE_LIMITS.IMAGE.maxSize + 1);
      await expect(attachments.uploadFile('p1', huge)).rejects.toThrow(/too large/i);
      http.expectNone(() => true);
    });

    it('rejects unsupported mime types before any HTTP call', async () => {
      const weird = file('blob.bin', 'application/x-octet', 100);
      await expect(attachments.uploadFile('p1', weird)).rejects.toThrow(/not supported/i);
      http.expectNone(() => true);
    });

    it('calls onProgress with monotonically increasing values', async () => {
      const f = file('a.txt', 'text/plain', 200);
      const progress: number[] = [];
      const uploadPromise = attachments.uploadFile('p1', f, (pct) => progress.push(pct));

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
        size: 200,
        url: 'u',
      });
      await uploadPromise;

      // First nudge is 5%, last is 100%, and values never decrease.
      expect(progress[0]).toBe(5);
      expect(progress[progress.length - 1]).toBe(100);
      for (let i = 1; i < progress.length; i++) {
        expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
      }
    });
  });

  describe('listResource', () => {
    it('GETs /api/pages/{guid}/attachments', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => attachments.listResource(guid));
      await settle();
      const req = http.expectOne('/api/pages/p1/attachments');
      expect(req.request.method).toBe('GET');
      req.flush({ attachments: [meta({ filename: 'a.pdf' })] });
      await settle();
      expect(resource.value()?.[0].filename).toBe('a.pdf');
    });

    it('re-requests after deleteAttachment for the same page (scoped invalidation)', async () => {
      const guid = signal<string | null>('p1');
      const resource = TestBed.runInInjectionContext(() => attachments.listResource(guid));
      await settle();
      http.expectOne('/api/pages/p1/attachments').flush({ attachments: [meta({ filename: 'one.pdf' })] });
      await settle();

      const promise = attachments.deleteAttachment('p1', 'one.pdf');
      http.expectOne('/api/pages/p1/attachments/one.pdf').flush(null);
      await promise;
      await settle();

      http.expectOne('/api/pages/p1/attachments').flush({ attachments: [meta({ filename: 'two.pdf' })] });
      await settle();
      expect(resource.value()?.[0].filename).toBe('two.pdf');
    });

    it('deleteAttachment on p1 does not re-request listResource(p2)', async () => {
      const g1 = signal<string | null>('p1');
      const g2 = signal<string | null>('p2');
      TestBed.runInInjectionContext(() => attachments.listResource(g1));
      const r2 = TestBed.runInInjectionContext(() => attachments.listResource(g2));
      await settle();
      http.expectOne('/api/pages/p1/attachments').flush({ attachments: [meta()] });
      http.expectOne('/api/pages/p2/attachments').flush({ attachments: [meta({ filename: 'keep.pdf' })] });
      await settle();

      const promise = attachments.deleteAttachment('p1', 'doc.pdf');
      http.expectOne('/api/pages/p1/attachments/doc.pdf').flush(null);
      await promise;
      await settle();

      http.expectOne('/api/pages/p1/attachments').flush({ attachments: [] });
      http.expectNone('/api/pages/p2/attachments');
      await settle();
      expect(r2.value()?.[0].filename).toBe('keep.pdf');
    });

    it('does not fetch when guid is null', async () => {
      const guid = signal<string | null>(null);
      TestBed.runInInjectionContext(() => attachments.listResource(guid));
      await settle();
      http.expectNone(() => true);
    });
  });

  describe('getAttachmentUrl', () => {
    it('GETs the attachment endpoint and returns the presigned url', async () => {
      const promise = attachments.getAttachmentUrl('p1', 'photo.jpg');
      const req = http.expectOne('/api/pages/p1/attachments/photo.jpg');
      expect(req.request.method).toBe('GET');
      req.flush({ url: 'https://s3.example.com/signed/photo.jpg' });
      await expect(promise).resolves.toBe('https://s3.example.com/signed/photo.jpg');
    });

    it('URL-encodes the filename', async () => {
      const promise = attachments.getAttachmentUrl('p1', 'my file.pdf');
      const req = http.expectOne('/api/pages/p1/attachments/my%20file.pdf');
      req.flush({ url: 'https://s3.example.com/signed/x' });
      await promise;
    });

    it('rejects when the request errors', async () => {
      const promise = attachments.getAttachmentUrl('p1', 'photo.jpg');
      http
        .expectOne('/api/pages/p1/attachments/photo.jpg')
        .flush('boom', { status: 500, statusText: 'Server Error' });
      await expect(promise).rejects.toBeTruthy();
    });
  });

  describe('deleteAttachment', () => {
    it('sends DELETE /api/pages/{guid}/attachments/{filename}', async () => {
      const promise = attachments.deleteAttachment('p1', 'photo.jpg');
      const req = http.expectOne('/api/pages/p1/attachments/photo.jpg');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await promise;
    });

    it('URL-encodes the filename', async () => {
      const promise = attachments.deleteAttachment('p1', 'my file.pdf');
      const req = http.expectOne('/api/pages/p1/attachments/my%20file.pdf');
      req.flush(null);
      await promise;
    });
  });
});
