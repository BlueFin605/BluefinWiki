import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AiAvailability } from './ai';

@Component({
  selector: 'wiki-ai-unavailable-state',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (availability()) {
      @case ('downloading') {
        <div class="ai-state">
          <h3>Downloading on-device AI...</h3>
          <p>
            Chrome is downloading the Gemini Nano model. This can take several
            minutes on first use. Track progress at
            <code>chrome://components</code> under
            "Optimization Guide On Device Model".
          </p>
        </div>
      }
      @case ('downloadable') {
        <div class="ai-state">
          <h3>AI is ready to download</h3>
          <p>
            Send your first message and Chrome will download the on-device
            model in the background. After that, it works offline.
          </p>
        </div>
      }
      @default {
        <div class="ai-state">
          <h3>AI assistant unavailable</h3>
          <p>
            The wiki uses Chrome's built-in Prompt API (Gemini Nano). Everything
            runs on-device — nothing leaves your browser. To enable it:
          </p>
          <ol>
            <li>
              Use <strong>Chrome 138+ on desktop</strong> (not Safari/Firefox,
              not mobile). Needs ~22 GB free disk and a GPU with 4 GB+ VRAM.
            </li>
            <li>
              Enable two flags, then restart Chrome:
              <ul>
                <li>
                  <code>chrome://flags/#prompt-api-for-gemini-nano</code>
                  -> <strong>Enabled</strong>
                </li>
                <li>
                  <code>chrome://flags/#optimization-guide-on-device-model</code>
                  -> <strong>Enabled BypassPerfRequirement</strong>
                </li>
              </ul>
            </li>
            <li>
              Check the model is installed:
              <code>chrome://components</code> ->
              "Optimization Guide On Device Model" should show a non-zero
              version.
            </li>
            <li>
              Verify in DevTools console:
              <code>await LanguageModel.availability()</code> should return
              <code>"available"</code>.
            </li>
          </ol>
          <p class="hint">
            Detected state: <code>{{ availability() }}</code>
          </p>
        </div>
      }
    }
  `,
  styles: [`
    .ai-state {
      padding: 1rem;
      font-size: 0.875rem;
      color: #374151;
    }
    .ai-state h3 { font-weight: 600; margin-bottom: 0.5rem; color: #111827; }
    .ai-state p { color: #4b5563; margin: 0.5rem 0; }
    .ai-state ol, .ai-state ul { padding-left: 1.5rem; }
    .ai-state li { margin: 0.5rem 0; }
    .ai-state code {
      background: #f3f4f6;
      padding: 0 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.8125rem;
    }
    .ai-state .hint { font-size: 0.75rem; color: #6b7280; }
  `],
})
export class UnavailableState {
  readonly availability = input.required<AiAvailability>();
}
