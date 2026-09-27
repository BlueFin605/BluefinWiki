import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/auth/auth';

export type ContextMenuEvent =
  | { kind: 'rename'; guid: string }
  | { kind: 'newChild'; guid: string }
  | { kind: 'sort'; guid: string; direction: 'asc' | 'desc' }
  | { kind: 'move'; guid: string }
  | { kind: 'delete'; guid: string };

/**
 * Right-click context menu for page tree rows. Hosts an invisible anchor at
 * `position` and opens a `mat-menu` against it. Items vary by `hasChildren`
 * and the current user's role.
 */
@Component({
  selector: 'wiki-page-context-menu',
  standalone: true,
  imports: [MatMenuModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="menu-anchor"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      [matMenuTriggerFor]="contextMenu"
    ></div>

    <mat-menu #contextMenu="matMenu">
      <button mat-menu-item type="button" (click)="emit({ kind: 'rename', guid: guid() })">
        <mat-icon>edit</mat-icon>
        <span>Rename</span>
      </button>
      <button mat-menu-item type="button" (click)="emit({ kind: 'newChild', guid: guid() })">
        <mat-icon>add</mat-icon>
        <span>New child page</span>
      </button>
      @if (hasChildren()) {
        <button mat-menu-item type="button" (click)="emit({ kind: 'sort', guid: guid(), direction: 'asc' })">
          <mat-icon>arrow_downward</mat-icon>
          <span>Sort children A-Z</span>
        </button>
        <button mat-menu-item type="button" (click)="emit({ kind: 'sort', guid: guid(), direction: 'desc' })">
          <mat-icon>arrow_upward</mat-icon>
          <span>Sort children Z-A</span>
        </button>
      }
      <button mat-menu-item type="button" (click)="emit({ kind: 'move', guid: guid() })">
        <mat-icon>swap_vert</mat-icon>
        <span>Move...</span>
      </button>
      @if (canDelete()) {
        <button mat-menu-item type="button" (click)="emit({ kind: 'delete', guid: guid() })">
          <mat-icon>delete</mat-icon>
          <span>Delete</span>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .menu-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none; }
  `],
})
export class PageContextMenu {
  private readonly auth = inject(Auth);

  readonly guid = input.required<string>();
  readonly hasChildren = input<boolean>(false);
  readonly menuEvent = output<ContextMenuEvent>();

  private readonly trigger = viewChild.required(MatMenuTrigger);

  protected readonly position = signal({ x: 0, y: 0 });
  protected readonly canDelete = computed(() => this.auth.user()?.role === 'Admin');

  open(position: { x: number; y: number }): void {
    this.position.set(position);
    this.trigger().openMenu();
  }

  close(): void {
    this.trigger().closeMenu();
  }

  emit(event: ContextMenuEvent): void {
    this.menuEvent.emit(event);
  }
}
