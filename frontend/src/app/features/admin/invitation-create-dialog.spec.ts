import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { InvitationCreateDialog } from './invitation-create-dialog';

function dialogRefStub() {
  return { close: jest.fn() };
}

async function renderDialog(ref = dialogRefStub()) {
  const result = await render(InvitationCreateDialog, {
    providers: [provideNoopAnimations(), { provide: MatDialogRef, useValue: ref }],
  });
  return { ...result, ref };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('InvitationCreateDialog', () => {
  it('defaults expiryDays to 7', async () => {
    await renderDialog();
    const input = screen.getByLabelText<HTMLInputElement>(/expires/i);
    expect(input.value).toBe('7');
  });

  it('allows 14 and closes with expiryDays: 14', async () => {
    const { ref } = await renderDialog();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/expires/i);
    await user.clear(input);
    await user.type(input, '14');
    await settle();

    expect(screen.queryByText(/between 1 and 30/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(ref.close).toHaveBeenCalledWith(
      expect.objectContaining({ expiryDays: 14 }),
    );
  });

  it('shows an inline error and blocks submit for 0', async () => {
    const { ref } = await renderDialog();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/expires/i);
    await user.clear(input);
    await user.type(input, '0');
    await settle();

    expect(screen.getByText(/between 1 and 30/i)).toBeInTheDocument();
    // A genuinely disabled button refuses pointer interaction (userEvent
    // throws on click) — that itself proves submit is blocked.
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('shows an inline error and blocks submit for 31', async () => {
    const { ref } = await renderDialog();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/expires/i);
    await user.clear(input);
    await user.type(input, '31');
    await settle();

    expect(screen.getByText(/between 1 and 30/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('shows an inline error and blocks submit when blank', async () => {
    const { ref } = await renderDialog();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/expires/i);
    await user.clear(input);
    await settle();

    expect(screen.getByText(/between 1 and 30/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
    expect(ref.close).not.toHaveBeenCalled();
  });
});
