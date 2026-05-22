import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Ai } from './ai';
import { ActionPreview } from './action-preview';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function baseProviders() {
  return [
    provideNoopAnimations(),
    provideHttpClient(),
    provideHttpClientTesting(),
  ];
}

describe('ActionPreview', () => {
  it('renders nothing when there is no pending action', async () => {
    const { container } = await render(ActionPreview, {
      providers: baseProviders(),
    });
    expect(container.querySelector('.preview')).toBeNull();
  });

  it('renders create_page details when an action is pending', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    // Seed an assistant message + pending action via internal helpers.
    // Easiest path: use the public surface — install LanguageModel stub and run sendMessage.
    installStub(
      '{"message":"sure","action":{"type":"create_page","title":"My Page"}}',
    );
    await ai.sendMessage('please');
    await settle();

    expect(screen.getByText('Create page')).toBeInTheDocument();
    expect(screen.getByText('My Page')).toBeInTheDocument();
  });

  it('clicking Apply calls Ai.acceptAction and clears the preview', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"ok","action":{"type":"update_page","pageGuid":"g","title":"new"}}',
    );
    await ai.sendMessage('rename');
    await settle();

    const apply = screen.getByRole('button', { name: /^apply$/i });
    await userEvent.setup().click(apply);
    await settle();

    expect(ai.currentAction()).toBeNull();
  });

  it('clicking Discard calls Ai.rejectAction', async () => {
    await render(ActionPreview, { providers: baseProviders() });
    const ai = TestBed.inject(Ai);
    installStub(
      '{"message":"ok","action":{"type":"update_page","pageGuid":"g","title":"new"}}',
    );
    await ai.sendMessage('rename');
    await settle();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /discard/i }));
    await settle();

    expect(ai.currentAction()).toBeNull();
  });

  afterEach(() => {
    delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
  });
});

function installStub(promptReturn: string): void {
  (globalThis as unknown as { LanguageModel: unknown }).LanguageModel = {
    availability: jest.fn().mockResolvedValue('available'),
    create: jest.fn().mockResolvedValue({
      prompt: jest.fn().mockResolvedValue(promptReturn),
      promptStreaming: jest.fn(),
      destroy: jest.fn(),
      inputUsage: 100,
      inputQuota: 1000,
    }),
  };
}
