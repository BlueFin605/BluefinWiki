import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  map,
  of,
  retry,
  startWith,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { WikiImage } from '../../shared/markdown/wiki-image';
import { Attachments } from './attachments';
import { Auth } from '../../core/auth/auth';
import { InvalidationBus, attachmentsTag } from '../../core/api/invalidation';
import {
  attachmentEmoji,
  buildAttachmentMarkdown,
  formatFileSize,
  isImageContentType,
} from './attachment.types';
import type { AttachmentMetadata } from './attachment.types';
import { nextDelay } from './backoff';
import { AttachmentLightbox } from './attachment-lightbox';

interface ListState {
  status: 'loading' | 'error' | 'resolved';
  items: readonly AttachmentMetadata[];
}

const LOADING: ListState = { status: 'loading', items: [] };

/** Newest upload first; ISO-8601 `uploadedAt` strings sort lexically. */
function sortNewestFirst(
  items: readonly AttachmentMetadata[],
): readonly AttachmentMetadata[] {
  return [...items].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * Lists a page's attachments (newest first) with per-row Insert / Download /
 * Copy-Markdown / Drag-Link / Delete actions, an image thumbnail + lightbox for
 * image types, and an exponential-backoff auto-retry (1s → 30s, ≤10 attempts)
 * on list-load failure plus a manual Refresh that also resets the backoff.
 *
 * Insert and Copy Markdown share one markdown builder,
 * {@link buildAttachmentMarkdown} — the single source of truth for
 * attachment → markdown across the app. Insert reaches the editor cursor via the
 * `insertMarkdown` output, wired inspector-panel → page-detail →
 * `insertMarkdownAtCursor`.
 */
@Component({
  selector: 'wiki-attachment-manager',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, WikiImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div class="head">
        <span class="count">
          @if (!isLoading() && !hasError()) {
            {{ items().length }} attachment{{ items().length === 1 ? '' : 's' }}
          }
        </span>
        <button
          mat-button
          type="button"
          aria-label="Refresh attachments"
          title="Refresh"
          (click)="refresh()"
        >
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      @if (isLoading()) {
        <p class="state">Loading attachments…</p>
      } @else if (hasError()) {
        <p class="state error">Failed to load attachments.</p>
      } @else if (items().length === 0) {
        <p class="state empty">No attachments yet.</p>
      } @else {
        <ul class="list">
          @for (item of items(); track item.filename) {
            <li
              class="row"
              draggable="true"
              (dragstart)="onDragStart($event, item)"
            >
              <div class="lead">
                <span class="emoji" aria-hidden="true">{{
                  emoji(item.filename, item.contentType)
                }}</span>
                @if (isImage(item.contentType)) {
                  <button
                    type="button"
                    class="thumb"
                    aria-label="Preview image"
                    title="Preview"
                    (click)="openLightbox(item)"
                  >
                    <wiki-image
                      [pageGuid]="pageGuid()"
                      [filename]="item.filename"
                      [alt]="item.filename"
                      width="56"
                    />
                  </button>
                }
              </div>

              <div class="meta">
                <span class="name">{{ item.filename }}</span>
                <span class="sub">
                  <span class="size">{{ format(item.size) }}</span>
                  <span class="date">{{ item.uploadedAt }}</span>
                </span>
              </div>

              <div class="actions">
                @if (canInsert()) {
                  <button
                    mat-icon-button
                    type="button"
                    aria-label="Insert into page"
                    title="Insert into page"
                    (click)="onInsert(item)"
                  >
                    <mat-icon>add_link</mat-icon>
                  </button>
                }
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Download"
                  title="Download"
                  (click)="onDownload(item)"
                >
                  <mat-icon>download</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Copy markdown"
                  title="Copy markdown"
                  (click)="onCopyMarkdown(item)"
                >
                  <mat-icon>content_copy</mat-icon>
                </button>
                @if (canDelete(item)) {
                  <button
                    mat-icon-button
                    type="button"
                    aria-label="Delete attachment"
                    title="Delete"
                    (click)="onDelete(item)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .panel { padding: 1rem; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .count { font-size: 0.75rem; color: #6b7280; }
    .state { color: #6b7280; font-size: 0.875rem; margin: 0; }
    .state.error { color: #b91c1c; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px; }
    .lead { flex: 0 0 auto; display: flex; align-items: center; gap: 0.375rem; }
    .thumb { display: block; padding: 0; border: 0; background: none; cursor: zoom-in; line-height: 0; width: 56px; }
    .emoji { font-size: 1.25rem; line-height: 1; }
    .meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
    .name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub { display: flex; gap: 0.5rem; font-size: 0.75rem; color: #6b7280; }
    .actions { flex: 0 0 auto; display: flex; gap: 0.125rem; }
  `],
})
export class AttachmentManager {
  private readonly attachments = inject(Attachments);
  private readonly auth = inject(Auth);
  private readonly bus = inject(InvalidationBus);
  private readonly dialog = inject(MatDialog);

  readonly pageGuid = input.required<string>();
  readonly pageAuthorId = input<string | null>(null);
  /** Whether the "insert into page" action is available (needs a live editor). */
  readonly canInsert = input<boolean>(true);
  readonly insertMarkdown = output<string>();

  /** Bumped by Refresh to force an immediate reload + reset the backoff. */
  private readonly refreshTick = signal(0);

  private readonly params = computed(() => ({
    guid: this.pageGuid(),
    tick: this.refreshTick(),
    // Re-read on scoped invalidation (delete / upload) so the list refetches.
    version: this.bus.version(attachmentsTag(this.pageGuid())),
  }));

  private readonly _state = signal<ListState>(LOADING);
  protected readonly isLoading = computed(() => this._state().status === 'loading');
  protected readonly hasError = computed(() => this._state().status === 'error');
  protected readonly items = computed(() => this._state().items);

  protected readonly format = formatFileSize;
  protected readonly emoji = attachmentEmoji;
  protected readonly isImage = isImageContentType;

  constructor() {
    toObservable(this.params)
      .pipe(
        switchMap(({ guid }) =>
          this.attachments.listAttachments(guid).pipe(
            // Exponential backoff: 1s, 2s, 4s … capped at 30s. The list is
            // loaded at most 10 times total (initial GET + up to 9 retries);
            // `nextDelay` returning `null` is the single stop condition —
            // re-raising the error then completes the retry via `catchError`.
            // A new `params` emission (Refresh, page change, invalidation)
            // tears down this inner subscription via `switchMap`, which cancels
            // any pending retry timer and restarts the backoff from scratch.
            retry({
              delay: (error: unknown, retryCount: number) => {
                const ms = nextDelay(retryCount);
                return ms === null ? throwError(() => error) : timer(ms);
              },
            }),
            map(
              (items): ListState => ({
                status: 'resolved',
                items: sortNewestFirst(items),
              }),
            ),
            catchError(() => of<ListState>({ status: 'error', items: [] })),
            startWith(LOADING),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this._state.set(state));
  }

  protected refresh(): void {
    this.refreshTick.update((n) => n + 1);
  }

  /** The single markdown form for an attachment — Insert and Copy both use it. */
  protected markdownFor(item: AttachmentMetadata): string {
    return buildAttachmentMarkdown(item.filename, item.contentType);
  }

  protected canDelete(item: AttachmentMetadata): boolean {
    const user = this.auth.user();
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return user.userId === this.pageAuthorId() || user.userId === item.uploadedBy;
  }

  protected onInsert(item: AttachmentMetadata): void {
    this.insertMarkdown.emit(this.markdownFor(item));
  }

  protected async onCopyMarkdown(item: AttachmentMetadata): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.markdownFor(item));
    } catch (err) {
      console.error('Failed to copy attachment markdown', err);
    }
  }

  protected async onDownload(item: AttachmentMetadata): Promise<void> {
    try {
      const url = await this.attachments.getAttachmentUrl(
        this.pageGuid(),
        item.filename,
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.filename;
      anchor.rel = 'noopener';
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      console.error('Failed to download attachment', err);
      window.alert('Failed to download attachment.');
    }
  }

  protected onDragStart(event: DragEvent, item: AttachmentMetadata): void {
    const md = this.markdownFor(item);
    event.dataTransfer?.setData('text/plain', md);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  protected openLightbox(item: AttachmentMetadata): void {
    this.dialog.open(AttachmentLightbox, {
      data: { pageGuid: this.pageGuid(), filename: item.filename },
      panelClass: 'wiki-attachment-lightbox-panel',
      maxWidth: '100vw',
      maxHeight: '100vh',
      autoFocus: 'dialog',
    });
  }

  protected async onDelete(item: AttachmentMetadata): Promise<void> {
    if (!window.confirm(`Delete ${item.filename}?`)) return;
    try {
      await this.attachments.deleteAttachment(this.pageGuid(), item.filename);
    } catch (err) {
      console.error('Failed to delete attachment', err);
      window.alert('Failed to delete attachment.');
    }
  }
}
