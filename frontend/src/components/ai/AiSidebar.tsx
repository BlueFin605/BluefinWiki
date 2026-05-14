import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ContextMeter } from './ContextMeter';
import { InstructionPicker } from './InstructionPicker';
import { UnavailableState } from './UnavailableState';
import { useAi } from './useAi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPageGuid?: string | null;
}

export function AiSidebar({ isOpen, onClose, currentPageGuid }: Props) {
  const {
    messages,
    usage,
    isThinking,
    availability,
    send,
    reset,
    applyAction,
    discardAction,
    selectedInstructions,
    loadedInstructions,
    toggleInstruction,
  } = useAi();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  if (!isOpen) return null;

  const canChat = availability === 'available' || availability === 'downloadable';
  const showSetup = availability !== null && availability !== 'available';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    const text = input;
    setInput('');
    send({ text, currentPageGuid });
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col"
      role="complementary"
      aria-label="AI assistant"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="font-semibold text-gray-900">AI assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reset}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
            aria-label="New chat"
            title="New chat (clears history)"
            disabled={messages.length === 0 && !usage}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
            aria-label="Close AI assistant"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {canChat && <ContextMeter usage={usage} />}

      {canChat && (
        <InstructionPicker
          selectedGuids={selectedInstructions}
          loadedGuids={loadedInstructions}
          onToggle={toggleInstruction}
          onAfterCreate={onClose}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {availability === null ? (
          <div className="text-sm text-gray-500">Checking availability…</div>
        ) : showSetup ? (
          <UnavailableState availability={availability} />
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-500">
            <p>
              Ask me about the wiki — I can summarise pages, propose new pages, edit
              existing ones, or move pages around. Every change is shown as a preview
              you confirm.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessage key={m.id} message={m} onApply={applyAction} onDiscard={discardAction} />
          ))
        )}

        {isThinking && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Thinking…
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={2}
            placeholder={canChat ? 'Ask the wiki…' : 'AI unavailable — see setup steps above'}
            disabled={!canChat || isThinking}
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={!canChat || isThinking || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
