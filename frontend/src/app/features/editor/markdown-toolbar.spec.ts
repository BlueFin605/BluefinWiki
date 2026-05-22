import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MarkdownToolbar } from './markdown-toolbar';
import type { ToolbarAction } from '../../shared/codemirror/wiki-codemirror';

async function renderToolbar(inputs: Partial<{ disabled: boolean }> = {}) {
  const actions: ToolbarAction[] = [];
  const result = await render(MarkdownToolbar, {
    inputs,
    providers: [provideAnimationsAsync()],
  });
  result.fixture.componentInstance.action.subscribe((a) => actions.push(a));
  return { ...result, actions };
}

describe('MarkdownToolbar', () => {
  it('emits "bold" when the bold button is clicked', async () => {
    const { actions } = await renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bold/i }));
    expect(actions).toEqual(['bold']);
  });

  it('emits "italic" when the italic button is clicked', async () => {
    const { actions } = await renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /italic/i }));
    expect(actions).toEqual(['italic']);
  });

  it('emits h1..h6 from the heading menu', async () => {
    const { actions } = await renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /heading/i }));
    await user.click(screen.getByRole('menuitem', { name: /heading 3/i }));
    expect(actions).toEqual(['h3']);
  });

  it('disables every button when disabled=true', async () => {
    await renderToolbar({ disabled: true });
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it('exposes accessible names on every action button', async () => {
    await renderToolbar();
    const expected = [
      /bold/i,
      /italic/i,
      /strikethrough/i,
      /heading/i,
      /bulleted list/i,
      /numbered list/i,
      /task/i,
      /link/i,
      /inline code/i,
      /code block/i,
    ];
    for (const name of expected) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
