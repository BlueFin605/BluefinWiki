import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  BoardSettingsPanel,
  type BoardSettingsPanelData,
  type BoardSettingsResult,
} from './board-settings-panel';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { BoardConfig, PageTypeDefinition } from '../pages/page.types';
import { TicketKeys } from '../ticket-keys/ticket-keys';

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
  ticketKeys: { backfill: jest.Mock } = { backfill: jest.fn() },
  snack: { open: jest.Mock } = { open: jest.fn() },
) {
  return render(BoardSettingsPanel, {
    providers: [
      provideAnimationsAsync(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: TicketKeys, useValue: ticketKeys },
      { provide: MatSnackBar, useValue: snack },
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
    const res = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0];
    expect(res.action).toBe('save');
    const arg = res.config;
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
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
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
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
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
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
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
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
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
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
    expect(arg.targetTypeGuids).toEqual(['pt-a', 'pt-b']);
    expect(arg.depth).toBe(3);
  });

  it('keeps a legacy targetTypeGuid selection on save when page types are unavailable, written as targetTypeGuids', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { targetTypeGuid: 'pt-legacy' }, pageTypes: [] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
    expect(arg.targetTypeGuids).toEqual(['pt-legacy']);
    expect(arg.targetTypeGuid).toBeUndefined();
  });

  it('keeps leafTypes on save when page types are unavailable', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { leafTypes: true }, pageTypes: [] }, dialogRef);
    await settle();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
    expect(arg.leafTypes).toBe(true);
  });

  it('opens in Specific types with the configured guids preselected', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { targetTypeGuids: ['pt-task', 'pt-bug'] }, pageTypes: [story, task, bug] }, dialogRef);
    await settle();
    expect(screen.getByRole('radio', { name: /specific types/i })).toBeChecked();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const arg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
    expect(arg.targetTypeGuids).toEqual(['pt-task', 'pt-bug']);
  });

  const TYPE = { name: 'Initiative', icon: '🎯', hasDefaults: true, canEdit: true };

  it('tags overridden sections', async () => {
    await renderPanel({ config: { columns: ['A'] }, pageTypes: [pageType()], type: TYPE, overridden: ['columns'] });
    await settle();
    const columnsSection = screen.getByRole('heading', { name: /columns/i }).closest('section')!;
    expect(within(columnsSection).getByText('overridden')).toBeInTheDocument();
    const viewSection = screen.getByRole('heading', { name: /default view/i }).closest('section')!;
    expect(within(viewSection).queryByText('overridden')).toBeNull();
  });

  it('Reset is offered only when the type has defaults and something is overridden', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { columns: ['A'] }, pageTypes: [pageType()], type: TYPE, overridden: ['columns'] }, dialogRef);
    await settle();
    await userEvent.setup().click(screen.getByRole('button', { name: /reset to 🎯 initiative default/i }));
    expect((dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].action).toBe('reset');
  });

  it('hides Reset with nothing overridden, and Save-as-default without edit rights', async () => {
    await renderPanel({ config: null, pageTypes: [pageType()], type: { ...TYPE, canEdit: false }, overridden: [] });
    await settle();
    expect(screen.queryByRole('button', { name: /reset to/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save as default/i })).toBeNull();
  });

  it('Save as default returns the full config with action saveAsDefault', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { columns: ['A'], defaultView: 'board' }, pageTypes: [pageType()], type: { ...TYPE, hasDefaults: false }, overridden: [] }, dialogRef);
    await settle();
    await userEvent.setup().click(screen.getByRole('button', { name: /save as default for 🎯 initiative pages/i }));
    const res = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0];
    expect(res.action).toBe('saveAsDefault');
    expect(res.config.columns).toEqual(['A']);
    expect(res.config.defaultView).toBe('board');
  });

  it('no type: neither extra button shows', async () => {
    await renderPanel({ config: null, pageTypes: [pageType()] });
    await settle();
    expect(screen.queryByRole('button', { name: /reset to|save as default/i })).toBeNull();
  });

  it('direct-children mode passes the incoming depth/parent-title/swap through when the type has defaults, so they are not false overrides', async () => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { columns: ['A'], depth: 4, showParentTitle: false, swapTitles: true }, pageTypes: [pageType()], type: TYPE, overridden: [] }, dialogRef);
    await settle();
    await userEvent.setup().click(screen.getByRole('button', { name: /^save$/i }));
    const cfg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
    expect(cfg.depth).toBe(4);
    expect(cfg.showParentTitle).toBe(false);
    expect(cfg.swapTitles).toBe(true);
  });

  it.each([
    ['untyped pages', undefined],
    ['types without defaults', { ...TYPE, hasDefaults: false }],
  ])('direct-children mode strips depth/parent-title/swap for %s', async (_label, type) => {
    const dialogRef = { close: jest.fn() };
    await renderPanel({ config: { columns: ['A'], depth: 4, showParentTitle: false, swapTitles: true }, pageTypes: [pageType()], type }, dialogRef);
    await settle();
    await userEvent.setup().click(screen.getByRole('button', { name: /^save$/i }));
    const cfg = (dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config;
    expect(cfg).toEqual({ columns: ['A'] });
  });

  describe('ticket keys', () => {
    const KEYS = { pageGuid: 'g1', canBackfill: true };
    const prefixInput = () => screen.getByRole('textbox', { name: /ticket key prefix/i });

    it('hides the ticket key section without ticketKeys', async () => {
      await renderPanel({ config: null, pageTypes: [pageType()], type: TYPE });
      await settle();
      expect(screen.queryByTestId('ticket-key-section')).toBeNull();
    });

    it('shows the section with the saved prefix when ticketKeys is set', async () => {
      await renderPanel({ config: { keyPrefix: 'BGT' }, pageTypes: [pageType()], type: TYPE, ticketKeys: KEYS });
      await settle();
      expect(screen.getByTestId('ticket-key-section')).toBeInTheDocument();
      expect(prefixInput()).toHaveValue('BGT');
    });

    it('upper-cases what is typed', async () => {
      await renderPanel({ config: null, pageTypes: [pageType()], ticketKeys: KEYS });
      await settle();
      await userEvent.setup().type(prefixInput(), 'bgt');
      await settle();
      expect(prefixInput()).toHaveValue('BGT');
    });

    it('flags an invalid prefix and disables Save and Save as default', async () => {
      await renderPanel({ config: null, pageTypes: [pageType()], type: { ...TYPE, hasDefaults: false }, ticketKeys: KEYS });
      await settle();
      const user = userEvent.setup();
      await user.type(prefixInput(), 'b');
      await user.tab();
      await settle();
      expect(screen.getByText(/2–10 letters\/digits, starting with a letter/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /save as default/i })).toBeDisabled();
    });

    it('Save carries the prefix in the config', async () => {
      const dialogRef = { close: jest.fn() };
      await renderPanel({ config: null, pageTypes: [pageType()], ticketKeys: KEYS }, dialogRef);
      await settle();
      const user = userEvent.setup();
      await user.type(prefixInput(), 'bgt');
      await settle();
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      expect((dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config.keyPrefix).toBe('BGT');
    });

    it('an empty prefix leaves keyPrefix out of the config', async () => {
      const dialogRef = { close: jest.fn() };
      await renderPanel({ config: { keyPrefix: 'BGT' }, pageTypes: [pageType()], ticketKeys: KEYS }, dialogRef);
      await settle();
      const user = userEvent.setup();
      await user.clear(prefixInput());
      await settle();
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      expect((dialogRef.close.mock.calls[0] as [BoardSettingsResult])[0].config).not.toHaveProperty('keyPrefix');
    });

    it('hides the Assign keys button without backfill rights', async () => {
      await renderPanel({ config: { keyPrefix: 'BGT' }, pageTypes: [pageType()], ticketKeys: { pageGuid: 'g1', canBackfill: false } });
      await settle();
      expect(screen.getByTestId('ticket-key-section')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /assign keys/i })).toBeNull();
    });

    it('disables Assign keys until a prefix has been saved', async () => {
      await renderPanel({ config: null, pageTypes: [pageType()], ticketKeys: KEYS });
      await settle();
      await userEvent.setup().type(prefixInput(), 'BGT');
      await settle();
      expect(screen.getByRole('button', { name: /assign keys to existing tickets/i })).toBeDisabled();
    });

    it('Assign keys backfills the Initiative and reports the counts', async () => {
      const ticketKeys = { backfill: jest.fn().mockResolvedValue({ assigned: 2, repaired: 1 }) };
      const snack = { open: jest.fn() };
      await renderPanel({ config: { keyPrefix: 'BGT' }, pageTypes: [pageType()], ticketKeys: KEYS }, { close: jest.fn() }, ticketKeys, snack);
      await settle();
      await userEvent.setup().click(screen.getByRole('button', { name: /assign keys to existing tickets/i }));
      await settle();
      expect(ticketKeys.backfill).toHaveBeenCalledWith('g1');
      expect(snack.open).toHaveBeenCalledWith('Assigned 2, repaired 1', 'Dismiss', { duration: 4000 });
      expect(screen.getByRole('button', { name: /assign keys to existing tickets/i })).toBeEnabled();
    });

    it('Assign keys reports a failure', async () => {
      const ticketKeys = { backfill: jest.fn().mockRejectedValue(new Error('boom')) };
      const snack = { open: jest.fn() };
      await renderPanel({ config: { keyPrefix: 'BGT' }, pageTypes: [pageType()], ticketKeys: KEYS }, { close: jest.fn() }, ticketKeys, snack);
      await settle();
      await userEvent.setup().click(screen.getByRole('button', { name: /assign keys to existing tickets/i }));
      await settle();
      expect(snack.open).toHaveBeenCalledWith('Failed to assign ticket keys.', 'Dismiss', { duration: 4000 });
      expect(screen.getByRole('button', { name: /assign keys to existing tickets/i })).toBeEnabled();
    });
  });
});
