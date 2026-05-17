import { ActionPreview } from './ActionPreview';
import type { ChatMessage as ChatMessageType } from './useAi';

interface Props {
  message: ChatMessageType;
  onApply: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function ChatMessage({ message, onApply, onDiscard }: Props) {
  if (message.role === 'system') {
    return (
      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {message.text}
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="font-medium truncate">{message.text}</span>
        <span className="text-gray-500 shrink-0 ml-auto">
          {message.toolMeta ? `${(message.toolMeta.bytes / 1024).toFixed(1)} KB${message.toolMeta.truncated ? ' (truncated)' : ''}` : ''}
        </span>
      </div>
    );
  }

  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.text}</div>
        {message.action && (
          <ActionPreview
            action={message.action}
            status={message.actionStatus}
            error={message.actionError}
            onApply={() => onApply(message.id)}
            onDiscard={() => onDiscard(message.id)}
          />
        )}
      </div>
    </div>
  );
}
