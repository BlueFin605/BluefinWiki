import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Ai, type AiAvailability } from './ai';
import { AiContextLoader } from './ai-context-loader';
import { ChatMessage } from './chat-message';
import { ContextMeter } from './context-meter';
import { ActionPreview } from './action-preview';
import { InstructionPicker } from './instruction-picker';
import { UnavailableState } from './unavailable-state';

@Component({
  selector: 'wiki-ai-sidebar',
  standalone: true,
  imports: [
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    ChatMessage,
    ContextMeter,
    ActionPreview,
    InstructionPicker,
    UnavailableState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-sidebar" role="complementary" aria-label="AI assistant">
      <mat-toolbar color="primary" class="header">
        <span class="title">AI assistant</span>
        <span class="spacer"></span>
        <button
          mat-icon-button
          type="button"
          aria-label="New chat"
          [disabled]="ai.messages().length === 0"
          (click)="onNewChat()"
        >
          <mat-icon>refresh</mat-icon>
        </button>
        <button
          mat-icon-button
          type="button"
          aria-label="Close AI assistant"
          (click)="closed.emit()"
        >
          <mat-icon>close</mat-icon>
        </button>
      </mat-toolbar>

      @if (availability() === null) {
        <p class="checking">Checking availability...</p>
      } @else if (!canChat()) {
        <wiki-ai-unavailable-state [availability]="availability()!" />
      } @else {
        <wiki-context-meter
          [usage]="ai.inputUsage()"
          [quota]="ai.inputQuota()"
        />
        <wiki-instruction-picker />

        <div class="messages" role="log" aria-label="Conversation">
          @if (ai.messages().length === 0) {
            <p class="hint">
              Ask me about the wiki — I can summarise pages, propose new pages,
              edit existing ones, or move pages around. Every change is shown
              as a preview you confirm.
            </p>
          }
          @for (m of ai.messages(); track m.id) {
            <wiki-chat-message [message]="m" />
          }
          @if (ai.streaming()) {
            <div class="thinking">Thinking...</div>
          }
        </div>

        <wiki-action-preview />

        <form class="input-row" (submit)="onSubmit($event)">
          <textarea
            [ngModel]="draft()"
            (ngModelChange)="draft.set($event)"
            name="ai-input"
            placeholder="Ask the wiki..."
            rows="2"
            [disabled]="ai.streaming()"
            (keydown.enter)="onEnterKey($event)"
            aria-label="Message"
          ></textarea>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="!canSend()"
          >
            Send
          </button>
        </form>
      }
    </div>
  `,
  styles: [`
    .ai-sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
    }
    .header { display: flex; align-items: center; }
    .title { font-weight: 600; }
    .spacer { flex: 1; }
    .checking, .hint {
      padding: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem 1rem;
    }
    .thinking {
      font-size: 0.75rem;
      color: #6b7280;
      padding: 0.5rem 0;
    }
    .input-row {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      border-top: 1px solid #e5e7eb;
      padding: 0.75rem;
    }
    textarea {
      flex: 1;
      resize: none;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      padding: 0.5rem;
      font-size: 0.875rem;
      font-family: inherit;
    }
    textarea:disabled { background: #f9fafb; color: #9ca3af; }
  `],
})
export class AiSidebar implements OnInit {
  protected readonly ai = inject(Ai);
  private readonly contextLoader = inject(AiContextLoader);

  readonly currentPageGuid = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly availability = signal<AiAvailability | null>(null);
  protected readonly draft = signal('');

  protected readonly canChat = computed(() => {
    const a = this.availability();
    return a === 'available' || a === 'downloadable';
  });

  protected readonly canSend = computed(
    () => !this.ai.streaming() && this.draft().trim().length > 0,
  );

  ngOnInit(): void {
    void this.refreshAvailability();
  }

  protected async refreshAvailability(): Promise<void> {
    this.availability.set(await this.ai.isAvailable());
  }

  protected onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      event.preventDefault();
      void this.doSend();
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.doSend();
  }

  protected onNewChat(): void {
    void this.ai.reset();
  }

  private async doSend(): Promise<void> {
    if (!this.canSend()) return;
    const text = this.draft().trim();
    this.draft.set('');
    try {
      const ragContext = await this.contextLoader.buildRagContext({
        currentPageGuid: this.currentPageGuid(),
        userMessage: text,
      });
      await this.ai.sendMessage(text, ragContext || undefined);
    } catch (err) {
      this.ai.appendSystemMessage(
        `AI error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
