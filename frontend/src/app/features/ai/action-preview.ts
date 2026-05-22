import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Ai, type AiAction } from './ai';

@Component({
  selector: 'wiki-action-preview',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (action(); as a) {
      <div
        class="preview"
        [class.destructive]="isDestructive()"
        role="region"
        aria-label="Proposed AI action"
      >
        <header>
          <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
          <span class="title">{{ label() }}</span>
          @if (isDestructive()) {
            <span class="destructive-tag">destructive</span>
          }
        </header>

        <div class="body">
          @switch (a.type) {
            @case ('create_page') {
              <dl>
                <dt>Title</dt><dd>{{ a.title }}</dd>
                @if (a.tags?.length) {
                  <dt>Tags</dt><dd>{{ a.tags?.join(', ') }}</dd>
                }
                @if (a.parentGuid) {
                  <dt>Parent</dt><dd><code>{{ a.parentGuid }}</code></dd>
                }
                @if (a.pageType) {
                  <dt>Type</dt><dd><code>{{ a.pageType }}</code></dd>
                }
                @if (a.content) {
                  <dt>Content</dt>
                  <dd><pre>{{ a.content }}</pre></dd>
                }
              </dl>
            }
            @case ('update_page') {
              <dl>
                <dt>Page</dt><dd><code>{{ a.pageGuid }}</code></dd>
                @if (a.title !== undefined) {
                  <dt>New title</dt><dd>{{ a.title }}</dd>
                }
                @if (a.tags !== undefined) {
                  <dt>New tags</dt><dd>{{ a.tags?.join(', ') || '(none)' }}</dd>
                }
                @if (a.pageType !== undefined) {
                  <dt>Type</dt><dd><code>{{ a.pageType }}</code></dd>
                }
                @if (a.content !== undefined) {
                  <dt>Content</dt>
                  <dd><pre>{{ a.content }}</pre></dd>
                }
              </dl>
            }
            @case ('delete_page') {
              <dl>
                <dt>Page</dt><dd><code>{{ a.pageGuid }}</code></dd>
                @if (a.recursive) {
                  <dt>Recursive</dt><dd>yes — also deletes children</dd>
                }
              </dl>
            }
            @case ('move_page') {
              <dl>
                <dt>Page</dt><dd><code>{{ a.pageGuid }}</code></dd>
                <dt>New parent</dt>
                <dd>
                  @if (a.newParentGuid) {
                    <code>{{ a.newParentGuid }}</code>
                  } @else {
                    <em>root</em>
                  }
                </dd>
              </dl>
            }
            @case ('fetch_url') {
              <dl>
                <dt>URL</dt><dd>{{ a.url }}</dd>
              </dl>
            }
            @case ('fetch_imdb_show') {
              <dl>
                @if (a.showQuery) { <dt>Show</dt><dd>{{ a.showQuery }}</dd> }
                @if (a.imdbId) { <dt>IMDb ID</dt><dd>{{ a.imdbId }}</dd> }
              </dl>
            }
            @default {
              <p>No-op action.</p>
            }
          }
        </div>

        <footer>
          <button
            type="button"
            mat-flat-button
            [color]="isDestructive() ? 'warn' : 'primary'"
            (click)="onAccept()"
          >
            {{ isDestructive() ? 'Apply (destructive)' : 'Apply' }}
          </button>
          <button type="button" mat-stroked-button (click)="onReject()">
            Discard
          </button>
        </footer>
      </div>
    }
  `,
  styles: [`
    .preview {
      margin: 0.5rem 0;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-size: 0.875rem;
    }
    .preview.destructive {
      border-color: #fecaca;
      background: #fef2f2;
    }
    header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 0.5rem;
    }
    .destructive-tag {
      font-size: 0.75rem;
      color: #b91c1c;
    }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 0.5rem; margin: 0; }
    dt { color: #6b7280; }
    dd { margin: 0; word-break: break-word; }
    pre {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.25rem;
      padding: 0.5rem;
      max-height: 12rem;
      overflow: auto;
      white-space: pre-wrap;
    }
    footer { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
  `],
})
export class ActionPreview {
  private readonly ai = inject(Ai);

  protected readonly action = computed(() => this.ai.currentAction());

  protected readonly isDestructive = computed(
    () => this.action()?.type === 'delete_page',
  );

  protected readonly label = computed(() => actionLabel(this.action()?.type));
  protected readonly icon = computed(() => actionIcon(this.action()?.type));

  protected onAccept(): void {
    // The sidebar wires this through the action runner; here we mark the
    // message accepted and clear the pending state. The actual HTTP mutation
    // is dispatched by the parent (AiSidebar).
    this.acceptedAction = this.ai.acceptAction();
    // The sidebar subscribes to currentAction() going null; the parent's
    // separate flow runs the HTTP call. We surface the accepted action via
    // a public getter for tests + the sidebar.
  }

  protected onReject(): void {
    this.ai.rejectAction();
  }

  /** Public for tests: the most recent action returned from acceptAction(). */
  acceptedAction: AiAction | null = null;
}

function actionLabel(type: AiAction['type'] | undefined): string {
  switch (type) {
    case 'create_page':
      return 'Create page';
    case 'update_page':
      return 'Update page';
    case 'delete_page':
      return 'Delete page';
    case 'move_page':
      return 'Move page';
    case 'fetch_url':
      return 'Fetch URL';
    case 'fetch_imdb_show':
      return 'Fetch IMDb show';
    default:
      return 'No action';
  }
}

function actionIcon(type: AiAction['type'] | undefined): string {
  switch (type) {
    case 'create_page':
      return 'add';
    case 'update_page':
      return 'edit';
    case 'delete_page':
      return 'delete';
    case 'move_page':
      return 'drive_file_move';
    case 'fetch_url':
      return 'link';
    case 'fetch_imdb_show':
      return 'movie';
    default:
      return 'remove';
  }
}
