import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { WikiImage } from '../../shared/markdown/wiki-image';

export interface AttachmentLightboxData {
  pageGuid: string;
  filename: string;
}

/**
 * Large modal preview (96vw × 92vh) of an image attachment, opened from the attachment
 * manager's row thumbnail (step 4.8). Hosts a full-size {@link WikiImage} that
 * presigns the attachment through the authed `Attachments` service. `MatDialog`
 * closes it on Escape and on a backdrop click; a close button is provided too.
 */
@Component({
  selector: 'wiki-attachment-lightbox',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatDialogModule, WikiImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      class="close"
      aria-label="Close preview"
      (click)="close()"
    >
      <mat-icon>close</mat-icon>
    </button>
    <div class="frame">
      <wiki-image
        [pageGuid]="data.pageGuid"
        [filename]="data.filename"
        [alt]="data.filename"
      />
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .close {
      position: absolute; top: 0.25rem; right: 0.25rem; z-index: 1;
      color: #fff;
    }
    .frame {
      display: flex; align-items: center; justify-content: center;
      max-width: 96vw; max-height: 92vh; overflow: auto;
    }
    .frame wiki-image { display: block; }
    .frame ::ng-deep img { max-width: 96vw; max-height: 92vh; width: auto; height: auto; }
  `],
})
export class AttachmentLightbox {
  protected readonly data = inject<AttachmentLightboxData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AttachmentLightbox>>(MatDialogRef);

  close(): void {
    this.dialogRef.close();
  }
}
