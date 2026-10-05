import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  BoardSettingsPanel,
  type BoardSettingsPanelData,
} from './board-settings-panel';
import type { BoardConfig, PageTypeDefinition } from '../pages/page.types';

function pageType(over: Partial<PageTypeDefinition> = {}): PageTypeDefinition {
  return {
    guid: 'pt-1',
    name: 'Task',
    icon: '✅',
    properties: [],
    allowedChildTypes: [],
    allowWikiPageChildren: false,
    allowedParentTypes: [],
    allowAnyParent: true,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

async function renderPanel(
  data: BoardSettingsPanelData,
  dialogRef: { close: jest.Mock } = { close: jest.fn() },
) {
  return render(BoardSettingsPanel, {
    providers: [
      provideAnimationsAsync(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('BoardSettingsPanel', () => {
  it('lists only state-bearing page types in the target-type select', async () => {
    const stateBearing = pageType({
      guid: 'pt-task',
      name: 'Task',
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const plain = pageType({ guid: 'pt-note', name: 'Note', properties: [] });
    await renderPanel({ config: null, pageTypes: [plain, stateBearing] });
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /specific types/i }));
    await user.click(screen.getByRole('combobox', { name: /page types/i }));
    await settle();
    expect(screen.getByRole('option', { name: /task/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /note/i })).not.toBeInTheDocument();
  });

  it('disables the target-type select and shows a hint when there are no boardable types', async () => {
    const plain = pageType({ guid: 'pt-note', name: 'Note', properties: [] });
    await renderPanel({ config: null, pageTypes: [plain] });
    await settle();
    expect(screen.getByRole('radio', { name: /leaf types/i })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /specific types/i })).toBeDisabled();
    expect(screen.getByText(/no page types define a "state" property/i)).toBeInTheDocument();
  });

  it('renders the existing columns from the config', async () => {
    const config: BoardConfig = { columns: ['To Do', 'Done'] };
    await renderPanel({ config, pageTypes: [pageType()] });
    await settle();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('lets the user add a new column', async () => {
    const config: BoardConfig = { columns: ['To Do'] };
    await renderPanel({ config, pageTypes: [pageType()] });
    await settle();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/new column/i);
    await user.type(input, 'Review');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('closes with the updated config when Save is clicked', async () => {
    const dialogRef = { close: jest.fn() };
    const config: BoardConfig = { columns: ['To Do'] };
    await renderPanel({ config, pageTypes: [pageType()] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/new column/i);
    await user.type(input, 'Review');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const call = dialogRef.close.mock.calls[0] as [BoardConfig | null];
    const arg = call[0] as BoardConfig;
    expect(arg.columns).toEqual(['To Do', 'Review']);
  });

  it('hides the parent-title toggles for a direct-children board (they would not be saved)', async () => {
    await renderPanel({ config: { columns: ['To Do'] }, pageTypes: [pageType()] });
    await settle();
    expect(screen.queryByRole('switch', { name: /show parent title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /use parent as primary/i })).not.toBeInTheDocument();
  });

  it('saves both parent-title toggles when a target type is set', async () => {
    const dialogRef = { close: jest.fn() };
    const stateBearing = pageType({
      guid: 'pt-task',
      properties: [{ name: 'state', type: 'string', required: false }],
    });
    const config: BoardConfig = { targetTypeGuid: 'pt-task', depth: 3 };
    await renderPanel({ config, pageTypes: [stateBearing] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: /show parent title/i }));
    await user.click(screen.getByRole('switch', { name: /use parent as primary/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.showParentTitle).toBe(false);
    expect(arg.swapTitles).toBe(true);
    expect(arg.targetTypeGuids).toEqual(['pt-task']);
    expect(arg.targetTypeGuid).toBeUndefined();
  });

  const STATE = [{ name: 'state', type: 'string' as const, required: false }];
  const story = pageType({ guid: 'pt-story', name: 'Story', icon: '📘', properties: STATE, allowedChildTypes: ['pt-task', 'pt-bug'] });
  const task = pageType({ guid: 'pt-task', name: 'Task', icon: '✅', properties: STATE });
  const bug = pageType({ guid: 'pt-bug', name: 'Bug', icon: '🐞', properties: STATE });

  it('opens in the mode the config implies', async () => {
    await renderPanel({ config: { leafTypes: true }, pageTypes: [story, task, bug] });
    await settle();
    expect(screen.getByRole('radio', { name: /leaf types/i })).toBeChecked();
  });

  it('leaf mode shows the currently resolved leaf types and saves leafTypes', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: null, pageTypes: [story, task, bug] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /leaf types/i }));
    await settle();
    expect(screen.getByText(/currently:/i)).toHaveTextContent('✅ Task · 🐞 Bug');
    expect(screen.getByRole('switch', { name: /show parent title/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.leafTypes).toBe(true);
    expect(arg.targetTypeGuids).toBeUndefined();
    expect(arg.depth).toBe(10);
  });

  it('specific types saves the multi-selection', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: null, pageTypes: [story, task, bug] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /specific types/i }));
    await user.click(screen.getByRole('combobox', { name: /page types/i }));
    await settle();
    await user.click(screen.getByRole('option', { name: /task/i }));
    await user.click(screen.getByRole('option', { name: /bug/i }));
    await user.keyboard('{Escape}');
    await settle();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.targetTypeGuids).toEqual(['pt-task', 'pt-bug']);
    expect(arg.leafTypes).toBeUndefined();
  });

  it('specific types with nothing selected saves as direct children', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: null, pageTypes: [story, task, bug] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /specific types/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.targetTypeGuids).toBeUndefined();
    expect(arg.leafTypes).toBeUndefined();
    expect(arg.depth).toBeUndefined();
  });
  it('keeps a targetTypeGuids selection on save when page types are unavailable', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { targetTypeGuids: ['pt-a', 'pt-b'], depth: 3 }, pageTypes: [] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.targetTypeGuids).toEqual(['pt-a', 'pt-b']);
    expect(arg.depth).toBe(3);
  });

  it('keeps a legacy targetTypeGuid selection on save when page types are unavailable, written as targetTypeGuids', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { targetTypeGuid: 'pt-legacy' }, pageTypes: [] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.targetTypeGuids).toEqual(['pt-legacy']);
    expect(arg.targetTypeGuid).toBeUndefined();
  });

  it('keeps leafTypes on save when page types are unavailable', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { leafTypes: true }, pageTypes: [] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.leafTypes).toBe(true);
  });

  it('opens in Specific types with the configured guids preselected', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { targetTypeGuids: ['pt-task', 'pt-bug'] }, pageTypes: [story, task, bug] }, dialogRef);
    await settle();
    expect(screen.getByRole('radio', { name: /specific types/i })).toBeChecked();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardConfig])[0];
    expect(arg.targetTypeGuids).toEqual(['pt-task', 'pt-bug']);
  });
});
