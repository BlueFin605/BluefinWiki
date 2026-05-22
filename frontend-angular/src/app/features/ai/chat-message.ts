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
      @default {
        <div class="msg assistant">
          <div class="bubble">
            <wiki-markdown-renderer [markdown]="text()" />
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .msg { display: flex; margin: 0.5rem 0; }
    .msg.user { justify-content: flex-end; }
    .msg.assistant { justify-content: flex-start; }
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
  `],
})
export class ChatMessage {
  readonly message = input.required<ChatMessageType>();

  protected readonly role = computed(() => this.message().role);
  protected readonly text = computed(() => this.message().text);
}
