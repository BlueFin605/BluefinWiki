import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Ai, type AiAction } from './ai';
import { AiActionRunner } from './ai-action-runner';
import { PageTitleResolver } from './page-title-resolver';

@Component({
  selector: 'wiki-action-preview',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, RouterLink],
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
                  <dt>Parent</dt>
                  <dd><a [routerLink]="['/pages', a.parentGuid]">{{ titleFor(a.parentGuid) }}</a></dd>
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
                <dt>Page</dt>
                <dd>
                  @if (a.pageGuid) {
                    <a [routerLink]="['/pages', a.pageGuid]">{{ titleFor(a.pageGuid) }}</a>
                  }
                </dd>
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
                <dt>Page</dt>
                <dd>
                  @if (a.pageGuid) {
                    <a [routerLink]="['/pages', a.pageGuid]">{{ titleFor(a.pageGuid) }}</a>
                  }
                </dd>
                @if (a.recursive) {
                  <dt>Recursive</dt><dd>yes — also deletes children</dd>
                }
              </dl>
            }
            @case ('move_page') {
              <dl>
                <dt>Page</dt>
                <dd>
                  @if (a.pageGuid) {
                    <a [routerLink]="['/pages', a.pageGuid]">{{ titleFor(a.pageGuid) }}</a>
                  }
                </dd>
                <dt>New parent</dt>
                <dd>
                  @if (a.newParentGuid) {
                    <a [routerLink]="['/pages', a.newParentGuid]">{{ titleFor(a.newParentGuid) }}</a>
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

        @if (actionStatus() === 'failed' && actionError()) {
          <p class="error" role="alert">{{ actionError() }}</p>
        }

        <footer>
          <button
            type="button"
            mat-flat-button
            [color]="isDestructive() ? 'warn' : 'primary'"
            [disabled]="isApplying()"
            (click)="onAccept()"
          >
            {{ applyLabel() }}
          </button>
          <button
            type="button"
            mat-stroked-button
            [disabled]="isApplying()"
            (click)="onReject()"
          >
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
    dd a { color: #2563eb; text-decoration: none; }
    dd a:hover { text-decoration: underline; }
    pre {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.25rem;
      padding: 0.5rem;
      max-height: 12rem;
      overflow: auto;
      white-space: pre-wrap;
    }
    .error {
      margin: 0.5rem 0 0;
      color: #b91c1c;
      font-size: 0.8125rem;
    }
    footer { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
  `],
})
export class ActionPreview {
  private readonly ai = inject(Ai);
  private readonly runner = inject(AiActionRunner);
  private readonly titleResolver = inject(PageTitleResolver);

  protected readonly action = computed(() => this.ai.currentAction());

  protected readonly isDestructive = computed(
    () => this.action()?.type === 'delete_page',
  );

  protected readonly label = computed(() => actionLabel(this.action()?.type));
  protected readonly icon = computed(() => actionIcon(this.action()?.type));

  /** The owning message's status, so the card can reflect applying/failed. */
  protected readonly actionStatus = computed(() => {
    const messages = this.ai.messages();
    const action = this.action();
    if (!action) return undefined;
    return messages.find((m) => m.action === action)?.actionStatus;
  });

  protected readonly actionError = computed(() => {
    const messages = this.ai.messages();
    const action = this.action();
    if (!action) return undefined;
    return messages.find((m) => m.action === action)?.actionError;
  });

  protected readonly isApplying = computed(
    () => this.actionStatus() === 'applying',
  );

  protected readonly applyLabel = computed(() => {
    if (this.isApplying()) return 'Applying…';
    return this.isDestructive() ? 'Apply (destructive)' : 'Apply';
  });

  private readonly resolvedTitles = signal<Record<string, string>>({});

  constructor() {
    // Resolve every page-GUID field of the current action to a title, once
    // per distinct GUID. Runs whenever `action()` changes (a new proposal,
    // or none). `PageTitleResolver` caches internally too, so a GUID shared
    // across turns is fetched once for the lifetime of the app.
    effect(() => {
      const a = this.action();
      if (!a) return;
      for (const guid of guidsOf(a)) {
        if (this.resolvedTitles()[guid] !== undefined) continue;
        void this.titleResolver.resolveTitle(guid).then((title) => {
          this.resolvedTitles.update((m) => ({ ...m, [guid]: title }));
        });
      }
    });
  }

  /** Title for a referenced page GUID — falls back to the raw GUID until resolved. */
  protected titleFor(guid: string): string {
    return this.resolvedTitles()[guid] ?? guid;
  }

  protected async onAccept(): Promise<void> {
    const pending = this.ai.beginApplyingAction();
    if (!pending) return;
    const { action, messageId } = pending;
    const result = await this.runner.run(action);
    if (result.ok) {
      this.ai.completeAction(messageId);
    } else {
      this.ai.markActionFailed(messageId, result.error ?? 'The action failed. Try again.');
    }
  }

  protected onReject(): void {
    this.ai.rejectAction();
  }
}

/** Every page-GUID field a proposed action may reference (excludes `pageType`, which is a page-*type* GUID, not a page). */
function guidsOf(action: AiAction): string[] {
  const guids: string[] = [];
  if (action.parentGuid) guids.push(action.parentGuid);
  if (action.pageGuid) guids.push(action.pageGuid);
  if (action.newParentGuid) guids.push(action.newParentGuid);
  return guids;
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
