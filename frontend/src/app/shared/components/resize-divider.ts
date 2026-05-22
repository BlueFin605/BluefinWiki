import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, type CdkDragMove } from '@angular/cdk/drag-drop';

/**
 * A draggable divider built on CDK `cdkDrag`. Emits a stream of pixel
 * positions (clientX for vertical orientation, clientY for horizontal).
 *
 * The `cdkDragFreeDragPosition` binding is pinned to {0,0} so the divider
 * never physically moves — parents handle the visual resize by binding the
 * `resize` output to a width/height signal.
 */
@Component({
  selector: 'wiki-resize-divider',
  standalone: true,
  imports: [CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="divider"
      [class.vertical]="orientation() === 'vertical'"
      [class.horizontal]="orientation() === 'horizontal'"
      cdkDrag
      [cdkDragLockAxis]="orientation() === 'vertical' ? 'x' : 'y'"
      [cdkDragFreeDragPosition]="zero"
      (cdkDragMoved)="onMove($event)"
      role="separator"
      [attr.aria-orientation]="orientation()"
    ></div>
  `,
  styles: [`
    :host { display: contents; }
    .divider { background: transparent; touch-action: none; user-select: none; }
    .divider.vertical { width: 4px; cursor: col-resize; height: 100%; }
    .divider.horizontal { height: 4px; cursor: row-resize; width: 100%; }
    .divider:hover { background: #2563eb; }
  `],
})
export class ResizeDivider {
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');
  readonly resized = output<number>();

  protected readonly zero = { x: 0, y: 0 } as const;

  onMove(event: CdkDragMove): void {
    const px =
      this.orientation() === 'vertical'
        ? event.pointerPosition.x
        : event.pointerPosition.y;
    this.resized.emit(px);
  }
}
