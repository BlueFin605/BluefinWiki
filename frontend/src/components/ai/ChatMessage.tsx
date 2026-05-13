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
