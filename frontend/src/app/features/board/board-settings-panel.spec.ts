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
});
