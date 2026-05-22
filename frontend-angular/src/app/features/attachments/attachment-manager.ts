import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Attachments } from './attachments';
import { Auth } from '../../core/auth/auth';
import { formatFileSize, isImageFile } from './attachment.types';
import type { AttachmentMetadata } from './attachment.types';

@Component({
  selector: 'wiki-attachment-manager',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      @if (resource.isLoading()) {
        <p class="state">Loading attachments...</p>
      } @else if (resource.error()) {
        <p class="state error">Failed to load attachments.</p>
      } @else if ((items() ?? []).length === 0) {
        <p class="state empty">No attachments yet.</p>
      } @else {
        <ul class="list">
          @for (item of items(); track item.filename) {
            <li class="row">
              <div class="meta">
                <span class="name">{{ item.filename }}</span>
                <span class="size">{{ format(item.size) }}</span>
                <span class="date">{{ item.uploadedAt }}</span>
              </div>
              <div class="actions">
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Insert into page"
                  title="Insert into page"
                  (click)="onInsert(item)"
                >
                  <mat-icon>add_link</mat-icon>
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
    .state { color: #6b7280; font-size: 0.875rem; margin: 0; }
    .state.error { color: #b91c1c; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px; }
    .meta { display: flex; flex-direction: column; gap: 0.125rem; }
    .name { font-weight: 500; }
    .size, .date { font-size: 0.75rem; color: #6b7280; }
    .actions { display: flex; gap: 0.125rem; }
  `],
})
export class AttachmentManager {
  private readonly attachments = inject(Attachments);
  private readonly auth = inject(Auth);

  readonly pageGuid = input.required<string>();
  readonly pageAuthorId = input<string | null>(null);
  readonly insertMarkdown = output<string>();

  private readonly guidSignal = computed(() => this.pageGuid());
  protected readonly resource = this.attachments.listResource(this.guidSignal);

  protected readonly items = computed<readonly AttachmentMetadata[]>(() => {
    if (this.resource.status() !== 'resolved') return [];
    return this.resource.value() ?? [];
  });

  protected format = formatFileSize;

  protected canDelete(item: AttachmentMetadata): boolean {
    const user = this.auth.user();
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return user.userId === this.pageAuthorId() || user.userId === item.uploadedBy;
  }

  protected onInsert(item: AttachmentMetadata): void {
    const url = `/api/pages/${this.pageGuid()}/attachments/${encodeURIComponent(item.filename)}`;
    const markdown = isImageFile(new File([], item.filename, { type: item.contentType }))
      ? `![${item.filename}](${url})`
      : `[${item.filename}](${url})`;
    this.insertMarkdown.emit(markdown);
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
