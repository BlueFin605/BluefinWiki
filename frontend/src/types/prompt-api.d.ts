/**
 * Type definitions for Chrome's built-in Prompt API (Gemini Nano).
 * Declared globally so `LanguageModel` is available without imports.
 * See https://developer.chrome.com/docs/ai/built-in for the live spec.
 *
 * Notable: `outputLanguage` isn't in the upstream typings — Chrome logs a
 * warning on every prompt without it, so we always pass 'en'.
 */

declare global {
  type LanguageModelAvailability =
    | 'available'
    | 'downloadable'
    | 'downloading'
    | 'unavailable';

  interface LanguageModelInitialPrompt {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  interface LanguageModelCreateOptions {
    initialPrompts?: LanguageModelInitialPrompt[];
    temperature?: number;
    topK?: number;
    outputLanguage?: 'en' | 'es' | 'ja';
    signal?: AbortSignal;
    monitor?: (m: EventTarget) => void;
  }

  interface LanguageModelPromptOptions {
    responseConstraint?: object;
    signal?: AbortSignal;
  }

  interface LanguageModelSession {
    readonly inputUsage: number;
    readonly inputQuota: number;
    prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
    promptStreaming(input: string, options?: LanguageModelPromptOptions): ReadableStream<string>;
    clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
    destroy(): void;
  }

  interface LanguageModelStatic {
    availability(): Promise<LanguageModelAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  }

  var LanguageModel: LanguageModelStatic | undefined;
}

export {};
