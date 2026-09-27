import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MarkdownRenderer } from '../../shared/markdown/markdown-renderer';
import type { ChatMessage as ChatMessageType } from './ai';

@Component({
  selector: 'wiki-chat-message',
  standalone: true,
  imports: [MarkdownRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (role()) {
      @case ('system') {
        <div class="msg system" role="alert">{{ text() }}</div>
      }
      @case ('user') {
        <div class="msg user">
          <div class="bubble">{{ text() }}</div>
        </div>
      }
      @case ('tool') {
        <div class="msg tool">
          <div class="tool-row" role="status">
            <span class="tool-icon" aria-hidden="true">&#128279;</span>
            <span class="tool-text">{{ text() }}</span>
            @if (toolMetaText(); as meta) {
              <span class="tool-size">{{ meta }}</span>
            }
          </div>
        </div>
      }
      @default {
        <div class="msg assistant">
          <div class="bubble">
            <wiki-markdown-renderer [markdown]="text()" />
          </div>
          @if (actionStatus(); as status) {
            <div class="action-status" [class]="'status-' + status" role="status">
              @switch (status) {
                @case ('pending') {
                  <span>Reviewing proposed change…</span>
                }
                @case ('applying') {
                  <span class="spinner" aria-hidden="true"></span>
                  <span>Applying…</span>
                }
                @case ('applied') {
                  <span aria-hidden="true">✓</span>
                  <span>Applied</span>
                }
                @case ('failed') {
                  <span aria-hidden="true">✕</span>
                  <span>Failed{{ actionError() ? ': ' + actionError() : '' }}</span>
                }
                @case ('discarded') {
                  <span>Discarded</span>
                }
              }
            </div>
          }
        </div>
      }
    }
  `,
  styles: [`
    .msg { display: flex; flex-direction: column; align-items: flex-start; margin: 0.5rem 0; }
    .msg.user { align-items: flex-end; }
    .msg.assistant { align-items: flex-start; }
    .bubble {
      max-width: 85%;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      white-space: pre-wrap;
    }
    .user .bubble { background: #2563eb; color: white; }
    .assistant .bubble { background: #f3f4f6; color: #111827; }
    .system {
      font-size: 0.75rem;
      color: #b91c1c;
      background: #fef2f2;
      border: 1px solid #fee2e2;
      border-radius: 0.375rem;
      padding: 0.25rem 0.5rem;
      margin: 0.5rem 0;
    }
    .msg.tool { align-items: stretch; width: 100%; }
    .tool-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #4b5563;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      padding: 0.375rem 0.625rem;
      width: 100%;
    }
    .tool-icon { flex-shrink: 0; }
    .tool-text {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tool-size { margin-left: auto; color: #6b7280; flex-shrink: 0; }
    .action-status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #6b7280;
    }
    .action-status.status-failed { color: #b91c1c; }
    .action-status.status-applied { color: #15803d; }
    .spinner {
      width: 0.75rem;
      height: 0.75rem;
      border: 2px solid #d1d5db;
      border-top-color: #2563eb;
      border-radius: 50%;
      display: inline-block;
      animation: wiki-ai-spin 0.7s linear infinite;
    }
    @keyframes wiki-ai-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ChatMessage {
  readonly message = input.required<ChatMessageType>();

  protected readonly role = computed(() => this.message().role);
  protected readonly text = computed(() => this.message().text);
  protected readonly actionStatus = computed(() => this.message().actionStatus);
  protected readonly actionError = computed(() => this.message().actionError);

  /** e.g. "2.0 KB" or "1.5 KB (truncated)" — undefined when there's no toolMeta. */
  protected readonly toolMetaText = computed(() => {
    const meta = this.message().toolMeta;
    if (!meta) return undefined;
    const kb = (meta.bytes / 1024).toFixed(1);
    return `${kb} KB${meta.truncated ? ' (truncated)' : ''}`;
  });
}
