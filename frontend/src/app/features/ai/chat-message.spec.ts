// Mock mermaid so the markdown pipeline can load in jsdom without ESM transforms.
jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), render: jest.fn() },
}));

import { render, screen } from '@testing-library/angular';
import { ChatMessage } from './chat-message';
import type { ChatMessage as ChatMessageType } from './ai';

function msg(over: Partial<ChatMessageType> = {}): ChatMessageType {
  return { id: '1', role: 'user', text: 'hi', ...over };
}

describe('ChatMessage', () => {
  it('renders a user message in the user bubble', async () => {
    await render(ChatMessage, {
      inputs: { message: msg({ role: 'user', text: 'hello there' }) },
    });
    expect(screen.getByText('hello there')).toBeInTheDocument();
  });

  it('renders an assistant message through the markdown renderer', async () => {
    await render(ChatMessage, {
      inputs: {
        message: msg({ role: 'assistant', text: 'assistant reply' }),
      },
    });
    expect(await screen.findByText('assistant reply')).toBeInTheDocument();
  });

  it('renders system messages with the alert role', async () => {
    await render(ChatMessage, {
      inputs: { message: msg({ role: 'system', text: 'oops' }) },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('oops');
  });

  it('renders nothing extra when actionStatus is absent', async () => {
    const { container } = await render(ChatMessage, {
      inputs: { message: msg({ role: 'assistant', text: 'hi' }) },
    });
    expect(container.querySelector('.action-status')).toBeNull();
  });

  it('renders the pending action status', async () => {
    await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'assistant',
          text: 'ok',
          actionStatus: 'pending',
        }),
      },
    });
    expect(screen.getByText(/reviewing proposed change/i)).toBeInTheDocument();
  });

  it('renders the applying action status with a spinner', async () => {
    const { container } = await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'assistant',
          text: 'ok',
          actionStatus: 'applying',
        }),
      },
    });
    expect(screen.getByText(/applying/i)).toBeInTheDocument();
    expect(container.querySelector('.spinner')).not.toBeNull();
  });

  it('renders the applied action status', async () => {
    await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'assistant',
          text: 'ok',
          actionStatus: 'applied',
        }),
      },
    });
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('renders the failed action status with the error text', async () => {
    await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'assistant',
          text: 'ok',
          actionStatus: 'failed',
          actionError: 'Server exploded',
        }),
      },
    });
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByText(/server exploded/i)).toBeInTheDocument();
  });

  it('renders a tool message as a grey info row', async () => {
    const { container } = await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'tool',
          text: 'Example Article',
          toolMeta: { url: 'https://example.com', bytes: 2048, truncated: false },
        }),
      },
    });
    expect(screen.getByText('Example Article')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(container.querySelector('.msg.tool')).not.toBeNull();
  });

  it('marks the truncated tool result in the meta text', async () => {
    await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'tool',
          text: 'Big Page',
          toolMeta: { url: 'https://example.com', bytes: 1536, truncated: true },
        }),
      },
    });
    expect(screen.getByText(/1\.5 KB \(truncated\)/)).toBeInTheDocument();
  });

  it('renders the discarded action status', async () => {
    await render(ChatMessage, {
      inputs: {
        message: msg({
          role: 'assistant',
          text: 'ok',
          actionStatus: 'discarded',
        }),
      },
    });
    expect(screen.getByText('Discarded')).toBeInTheDocument();
  });
});
