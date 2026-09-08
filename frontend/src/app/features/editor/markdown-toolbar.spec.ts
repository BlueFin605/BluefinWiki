import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MatMenu } from '@angular/material/menu';
import { MarkdownToolbar } from './markdown-toolbar';
import type { ToolbarAction } from '../../shared/codemirror/wiki-codemirror';

async function renderToolbar(inputs: Partial<{ disabled: boolean; compact: boolean }> = {}) {
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

  it('emits "image" when the image button is clicked', async () => {
    const { actions } = await renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /image/i }));
    expect(actions).toEqual(['image']);
  });

  it('emits "attachment" when the attachment button is clicked', async () => {
    const { actions } = await renderToolbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /attachment/i }));
    expect(actions).toEqual(['attachment']);
  });

  it('hides the ordered-list, task-list and code-block buttons in compact mode', async () => {
    await renderToolbar({ compact: true });
    expect(screen.queryByRole('button', { name: /numbered list/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /task list/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /code block/i })).toBeNull();
    // The reduced set still keeps these controls.
    expect(screen.getByRole('button', { name: /bulleted list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inline code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attachment/i })).toBeInTheDocument();
  });

  it('keeps the full button set when not compact', async () => {
    await renderToolbar();
    expect(screen.getByRole('button', { name: /numbered list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /code block/i })).toBeInTheDocument();
  });

  it('flips the heading menu to open upward in compact mode', async () => {
    const { fixture } = await renderToolbar({ compact: true });
    const menu = fixture.debugElement.query(By.directive(MatMenu)).componentInstance as MatMenu;
    expect(menu.yPosition).toBe('above');
  });

  it('opens the heading menu downward when not compact', async () => {
    const { fixture } = await renderToolbar();
    const menu = fixture.debugElement.query(By.directive(MatMenu)).componentInstance as MatMenu;
    expect(menu.yPosition).toBe('below');
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
      /image/i,
      /attachment/i,
      /inline code/i,
      /code block/i,
    ];
    for (const name of expected) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
