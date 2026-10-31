import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TypedConfirmDialog } from './typed-confirm-dialog';

async function renderDialog() {
  const ref = { close: jest.fn() };
  await render(TypedConfirmDialog, {
    providers: [
      provideNoopAnimations(),
      { provide: MatDialogRef, useValue: ref },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Project Plan', message: 'Deletes all child pages too.' },
      },
    ],
  });
  return { ref, user: userEvent.setup() };
}

const deleteButton = () => screen.getByRole('button', { name: /^delete$/i });

describe('TypedConfirmDialog', () => {
  it('shows the message and disables Delete initially', async () => {
    await renderDialog();
    expect(screen.getByText('Deletes all child pages too.')).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();
  });

  it('keeps Delete disabled for partial or wrong text', async () => {
    const { user } = await renderDialog();
    const input = screen.getByRole('textbox');
    await user.type(input, 'Project');
    expect(deleteButton()).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'Something else');
    expect(deleteButton()).toBeDisabled();
  });

  it('enables Delete on an exact match and closes with true', async () => {
    const { user, ref } = await renderDialog();
    await user.type(screen.getByRole('textbox'), 'Project Plan');
    expect(deleteButton()).toBeEnabled();
    await user.click(deleteButton());
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('matches ignoring case and surrounding whitespace', async () => {
    const { user } = await renderDialog();
    await user.type(screen.getByRole('textbox'), '  project plan  ');
    expect(deleteButton()).toBeEnabled();
  });

  it('Cancel closes without true', async () => {
    const { user, ref } = await renderDialog();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(ref.close).toHaveBeenCalledWith(false);
    expect(ref.close).not.toHaveBeenCalledWith(true);
  });
});
