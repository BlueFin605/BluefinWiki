import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { Attachments } from '../../features/attachments/attachments';

export interface WikiImageResize {
  /** Size-stripped alt text of the resized image (matches the markdown token). */
  alt: string;
  /** New width in CSS pixels. */
  width: number;
}

/** A URI scheme (`http:`, `https:`, `data:`, `blob:`, …) or protocol-relative `//`. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const API_ATTACHMENT = /^\/api\/pages\/([^/]+)\/attachments\/(.+)$/;
const MIN_WIDTH = 40;

type Request =
  | { kind: 'direct'; url: string }
  | { kind: 'fetch'; pageGuid: string; filename: string }
  | { kind: 'none' };

/**
 * Authed image component. Given an attachment reference it resolves a presigned
 * URL through the `Attachments` service (authed `HttpClient`), showing a loading
 * state, then the `<img>` on success or "Failed to load image" on error.
 * External URLs (`http(s)://`, `data:`) render directly with no request.
 *
 * Reusable outside the markdown pipeline: pass `[pageGuid]` + `[filename]` (or a
 * `[src]` that is either an external URL or a `/api/pages/:guid/attachments/:file`
 * path). Step 4.8's attachment manager reuses it for thumbnails and the
 * full-screen lightbox.
 *
 * When `[resizable]` is set (edit / split preview) a drag handle is shown on the
 * rendered image; dragging emits `(resize)` with the final pixel width, which
 * `page-detail` feeds to `setImageWidth` to rewrite `![alt|WIDTH]` in the source.
 */
@Component({
  selector: 'wiki-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (view()) {
      @case ('loading') {
        <span class="wiki-image-loading">Loading image…</span>
      }
      @case ('error') {
        <span class="wiki-image-error">Failed to load image</span>
      }
      @case ('image') {
        <span class="wiki-image-wrap">
          <img
            #img
            [attr.src]="displaySrc()"
            [attr.alt]="alt()"
            [attr.width]="width()"
            [style.width.px]="livePx()"
          />
          @if (resizable()) {
            <button
              type="button"
              class="wiki-image-handle"
              aria-label="Resize image"
              (mousedown)="onHandleDown($event)"
              (keydown)="onHandleKey($event)"
            ></button>
          }
        </span>
      }
    }
  `,
  styles: [`
    :host { display: inline-block; max-width: 100%; }
    .wiki-image-wrap { position: relative; display: inline-block; max-width: 100%; line-height: 0; }
    .wiki-image-wrap img { max-width: 100%; height: auto; border-radius: 0.375rem; display: block; }
    .wiki-image-loading { display: inline-block; padding: 0.5rem 0.75rem; color: rgba(0, 0, 0, 0.6); font-size: 0.875rem; }
    .wiki-image-error { display: inline-block; padding: 0.5rem 0.75rem; border-radius: 0.375rem; background: #fef2f2; border: 1px solid #fca5a5; color: #b91c1c; font-size: 0.875rem; }
    .wiki-image-handle {
      position: absolute; right: -6px; bottom: -6px; width: 14px; height: 14px;
      padding: 0; margin: 0; border: 2px solid #ffffff; border-radius: 3px;
      background: #2563eb; cursor: nwse-resize; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
    }
    .wiki-image-handle:focus-visible { outline: 2px solid #1e40af; outline-offset: 2px; }
  `],
})
export class WikiImage {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** External URL, `/api/pages/:guid/attachments/:file` path, or bare filename. */
  readonly src = input<string>('');
  /** Attachment filename — the non-pipeline input surface (with `pageGuid`). */
  readonly filename = input<string>('');
  /** Page whose attachment store holds the file. */
  readonly pageGuid = input<string>('');
  readonly alt = input<string>('');
  /** Passthrough width attribute (e.g. `"200px"` from `remark-image-size`). */
  readonly width = input<string | null>(null);
  /** Show the drag-to-resize handle (edit / split preview only). */
  readonly resizable = input<boolean>(false);

  readonly resized = output<WikiImageResize>();

  private readonly imgRef = viewChild<ElementRef<HTMLImageElement>>('img');

  private readonly _status = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  private readonly _resolvedUrl = signal<string | null>(null);
  private readonly _livePx = signal<number | null>(null);

  readonly livePx = this._livePx.asReadonly();

  private readonly request = computed<Request>(() => {
    const src = this.src().trim();
    const guid = this.pageGuid().trim();
    const name = this.filename().trim();

    if (src && ABSOLUTE.test(src)) return { kind: 'direct', url: src };

    const apiMatch = API_ATTACHMENT.exec(src);
    if (apiMatch) {
      return { kind: 'fetch', pageGuid: apiMatch[1], filename: decodeURIComponent(apiMatch[2]) };
    }
    if (guid && (name || src)) {
      return { kind: 'fetch', pageGuid: guid, filename: name || src };
    }
    if (src) return { kind: 'direct', url: src };
    return { kind: 'none' };
  });

  readonly view = computed<'loading' | 'error' | 'image' | 'none'>(() => {
    const req = this.request();
    if (req.kind === 'none') return 'none';
    if (req.kind === 'direct') return 'image';
    switch (this._status()) {
      case 'loaded':
        return 'image';
      case 'error':
        return 'error';
      default:
        return 'loading';
    }
  });

  readonly displaySrc = computed<string | null>(() => {
    const req = this.request();
    return req.kind === 'direct' ? req.url : this._resolvedUrl();
  });

  constructor() {
    effect((onCleanup) => {
      const req = this.request();
      if (req.kind !== 'fetch') {
        this._status.set('idle');
        this._resolvedUrl.set(null);
        return;
      }
      let cancelled = false;
      onCleanup(() => { cancelled = true; });

      this._status.set('loading');
      this._resolvedUrl.set(null);

      const attachments = this.injector.get(Attachments);
      void attachments.getAttachmentUrl(req.pageGuid, req.filename).then(
        (url) => {
          if (cancelled) return;
          this._resolvedUrl.set(url);
          this._status.set('loaded');
        },
        () => {
          if (!cancelled) this._status.set('error');
        },
      );
    });

    this.destroyRef.onDestroy(() => this.detachDrag());
  }

  // --- drag-to-resize ------------------------------------------------------

  private dragStartX = 0;
  private dragStartWidth = 0;

  private readonly onDragMove = (event: MouseEvent): void => {
    const next = Math.max(MIN_WIDTH, this.dragStartWidth + (event.clientX - this.dragStartX));
    this._livePx.set(Math.round(next));
  };

  private readonly onDragEnd = (): void => {
    this.detachDrag();
    const px = this._livePx();
    this._livePx.set(null);
    if (px != null) this.resized.emit({ alt: this.alt(), width: px });
  };

  onHandleDown(event: MouseEvent): void {
    event.preventDefault();
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.currentWidth();
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }

  onHandleKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 50 : 10;
    let delta: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = step;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -step;
    else return;
    event.preventDefault();
    const next = Math.max(MIN_WIDTH, this.currentWidth() + delta);
    this.resized.emit({ alt: this.alt(), width: Math.round(next) });
  }

  private detachDrag(): void {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  }

  private currentWidth(): number {
    const rendered = this.imgRef()?.nativeElement.offsetWidth ?? 0;
    if (rendered > 0) return rendered;
    const attr = parseInt(this.width() ?? '', 10);
    return Number.isFinite(attr) && attr > 0 ? attr : 400;
  }
}
