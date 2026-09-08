import { HttpClient, HttpEventType, type HttpEvent } from '@angular/common/http';
import { Injectable, type Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map, tap } from 'rxjs';
import { InvalidationBus, attachmentsTag } from '../../core/api/invalidation';
import type {
  AttachmentMetadata,
  AttachmentUploadResponse,
} from './attachment.types';
import { validateFile } from './attachment.types';

interface PresignResponse {
  uploadUrl: string;
  attachmentKey: string;
  filename: string;
}

@Injectable({ providedIn: 'root' })
export class Attachments {
  private readonly http = inject(HttpClient);
  private readonly bus = inject(InvalidationBus);

  /**
   * Upload a file via the three-step presigned-URL pipeline. The S3 PUT uses
   * an absolute URL so the auth interceptor (which only touches `/api`) skips
   * it — the S3 signed URL provides auth.
   */
  async uploadFile(
    pageGuid: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<AttachmentUploadResponse> {
    const validationError = validateFile(file);
    if (validationError) throw new Error(validationError);

    onProgress?.(5);

    // 1. presign
    const presign = await firstValueFrom(
      this.http.post<PresignResponse>(
        `/api/pages/${pageGuid}/attachments/presign`,
        { filename: file.name, contentType: file.type, size: file.size },
      ),
    );

    // 2. S3 PUT — absolute URL, bypasses /api interceptor.
    await firstValueFrom(
      this.http
        .put(presign.uploadUrl, file, {
          headers: { 'Content-Type': file.type },
          observe: 'events',
          reportProgress: true,
        })
        .pipe(
          tap((event: HttpEvent<unknown>) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              const pct = 10 + Math.round((event.loaded * 80) / event.total);
              onProgress?.(pct);
            }
          }),
          filter((event: HttpEvent<unknown>) => event.type === HttpEventType.Response),
        ),
    );

    // 3. confirm
    onProgress?.(95);
    const confirmed = await firstValueFrom(
      this.http.post<AttachmentUploadResponse>(
        `/api/pages/${pageGuid}/attachments/confirm`,
        {
          filename: presign.filename,
          contentType: file.type,
          size: file.size,
          attachmentKey: presign.attachmentKey,
        },
      ),
    );
    onProgress?.(100);
    this.bus.bump(attachmentsTag(pageGuid));
    return confirmed;
  }

  /** Keys on `attachments:<pageGuid>`. */
  listResource(pageGuid: Signal<string | null>) {
    return rxResource({
      params: () => {
        const g = pageGuid();
        return { guid: g, v: g ? this.bus.version(attachmentsTag(g)) : 0 };
      },
      stream: ({ params }) => {
        if (!params.guid) {
          throw new Error('listResource: pageGuid is null');
        }
        return this.http
          .get<{ attachments: AttachmentMetadata[] }>(`/api/pages/${params.guid}/attachments`)
          .pipe(map((r) => r.attachments ?? []));
      },
    });
  }

  async deleteAttachment(pageGuid: string, filename: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        `/api/pages/${pageGuid}/attachments/${encodeURIComponent(filename)}`,
      ),
    );
    this.bus.bump(attachmentsTag(pageGuid));
  }
}
