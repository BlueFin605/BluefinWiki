import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AiButton } from './ai-button';

describe('AiButton', () => {
  it('renders a button with the AI assistant label', async () => {
    await render(AiButton, { providers: [provideNoopAnimations()] });
    expect(
      screen.getByRole('button', { name: /open ai assistant/i }),
    ).toBeInTheDocument();
  });

  it('emits toggled when clicked', async () => {
    const onToggled = jest.fn();
    await render(AiButton, {
      providers: [provideNoopAnimations()],
      on: { toggled: onToggled },
    });
    await userEvent.setup().click(
      screen.getByRole('button', { name: /open ai assistant/i }),
    );
    expect(onToggled).toHaveBeenCalled();
  });

  it('is disabled when disabled input is true', async () => {
    await render(AiButton, {
      providers: [provideNoopAnimations()],
      inputs: { disabled: true },
    });
    expect(
      screen.getByRole('button', { name: /open ai assistant/i }),
    ).toBeDisabled();
  });
});
