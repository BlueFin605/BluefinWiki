import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { Attachments } from './attachments';
import {
  type AttachmentUploadProgress,
  type AttachmentUploadResponse,
  validateFile,
} from './attachment.types';

@Component({
  selector: 'wiki-attachment-uploader',
  standalone: true,
  imports: [MatButtonModule, MatProgressBarModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dropzone"
      [class.dragover]="dragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <mat-icon>cloud_upload</mat-icon>
      <p>Drop files here, or</p>
      <input
        #fileInput
        type="file"
        multiple
        hidden
        (change)="onPicked($event)"
      />
      <button mat-stroked-button type="button" (click)="fileInput.click()">Browse</button>
    </div>

    @if (errorMessages().length > 0) {
      <ul class="errors">
        @for (msg of errorMessages(); track msg) {
          <li>{{ msg }}</li>
        }
      </ul>
    }

    @if (progressEntries().length > 0) {
      <ul class="progress-list">
        @for (entry of progressEntries(); track entry.key) {
          <li>
            <div class="name">{{ entry.value.file.name }}</div>
            <mat-progress-bar mode="determinate" [value]="entry.value.progress"></mat-progress-bar>
            <div class="status">{{ entry.value.status }}</div>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .dropzone {
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      color: #6b7280;
      transition: background-color 0.15s;
    }
    .dropzone.dragover { background: #dbeafe; border-color: #2563eb; }
    .errors { list-style: none; padding: 0; margin: 0.5rem 0 0; color: #b91c1c; font-size: 0.875rem; }
    .progress-list { list-style: none; padding: 0; margin: 0.75rem 0 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .name { font-size: 0.875rem; }
    .status { font-size: 0.75rem; color: #6b7280; }
  `],
})
export class AttachmentUploader {
  private readonly attachments = inject(Attachments);

  readonly pageGuid = input.required<string>();
  readonly uploaded = output<AttachmentUploadResponse>();

  protected readonly dragOver = signal(false);
  private readonly _progress = signal<Map<string, AttachmentUploadProgress>>(new Map());
  protected readonly errorMessages = signal<readonly string[]>([]);

  protected readonly progressEntries = computed(() => {
    const map = this._progress();
    return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
  });

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    await this.handleFiles(files);
  }

  async onPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.handleFiles(files);
  }

  async handleFiles(files: File[]): Promise<void> {
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of files) {
      const err = validateFile(f);
      if (err) errors.push(`${f.name}: ${err}`);
      else valid.push(f);
    }
    if (errors.length) this.errorMessages.set(errors);
    else this.errorMessages.set([]);

    // Process uploads sequentially so progress is easy to track.
    for (const file of valid) {
      const key = `${file.name}:${file.size}:${Date.now()}`;
      this.setProgress(key, { file, progress: 0, status: 'pending' });
      try {
        const response = await this.attachments.uploadFile(
          this.pageGuid(),
          file,
          (pct) => this.setProgress(key, { file, progress: pct, status: 'uploading' }),
        );
        this.setProgress(key, {
          file,
          progress: 100,
          status: 'completed',
          attachmentGuid: response.attachmentGuid,
          filename: response.filename,
          url: response.url,
        });
        this.uploaded.emit(response);
      } catch (err) {
        const message = (err as { message?: string })?.message ?? 'Upload failed';
        this.setProgress(key, { file, progress: 0, status: 'failed', error: message });
        this.errorMessages.update((cur) => [...cur, `${file.name}: ${message}`]);
      }
    }
  }

  private setProgress(key: string, value: AttachmentUploadProgress): void {
    this._progress.update((map) => {
      const next = new Map(map);
      next.set(key, value);
      return next;
    });
  }
}
