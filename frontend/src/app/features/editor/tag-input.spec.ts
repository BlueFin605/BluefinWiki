import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ENTER, COMMA } from '@angular/cdk/keycodes';
import { TagInput } from './tag-input';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function renderInput(
  inputs: { tags?: readonly string[]; vocab?: readonly string[]; readOnly?: boolean } = {},
) {
  const result = await render(TagInput, {
    inputs: { tags: inputs.tags ?? [], vocab: inputs.vocab ?? [], readOnly: inputs.readOnly ?? false },
    providers: [provideAnimationsAsync()],
  });
  await settle();
  result.fixture.detectChanges();
  return result;
}

function field(): HTMLElement {
  return screen.getByPlaceholderText('Add tag');
}

/** Dispatch a real keydown Material's chip input recognises (it keys on `keyCode`). */
function pressKey(el: HTMLElement, key: string, keyCode: number): void {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }),
  );
}

/** Type `text` then commit it with Enter, as a user would. */
async function addTag(text: string): Promise<void> {
  const el = field();
  el.focus();
  await userEvent.type(el, text);
  pressKey(el, 'Enter', ENTER);
  await settle();
}

/** Latest value emitted from `tagsChange`. */
function captureChanges(result: Awaited<ReturnType<typeof renderInput>>): string[][] {
  const seen: string[][] = [];
  result.fixture.componentInstance.tagsChange.subscribe((v) => seen.push([...v]));
  return seen;
}

describe('TagInput', () => {
  it('renders a chip per applied tag', async () => {
    await renderInput({ tags: ['alpha', 'beta'] });
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('adds a new tag lower-cased and trimmed on Enter', async () => {
    const result = await renderInput({ tags: [] });
    const changes = captureChanges(result);

    await addTag('  Foo  ');

    expect(changes).toEqual([['foo']]);
  });

  it('adds a new tag on comma', async () => {
    const result = await renderInput({ tags: ['foo'] });
    const changes = captureChanges(result);

    const el = field();
    el.focus();
    await userEvent.type(el, 'Bar');
    pressKey(el, ',', COMMA);
    await settle();

    expect(changes).toEqual([['foo', 'bar']]);
  });

  it('case-insensitive dedupe: re-adding an applied tag in a different case is a no-op', async () => {
    const result = await renderInput({ tags: ['foo'] });
    const changes = captureChanges(result);

    await addTag('FOO');

    expect(changes).toEqual([]);
  });

  it('Backspace on an empty input removes the last chip', async () => {
    const result = await renderInput({ tags: ['a', 'b', 'c'] });
    const changes = captureChanges(result);

    field().focus();
    pressKey(field(), 'Backspace', 8);
    await settle();

    expect(changes).toEqual([['a', 'b']]);
  });

  it('Backspace does nothing while the input still holds text', async () => {
    const result = await renderInput({ tags: ['a', 'b'] });
    const changes = captureChanges(result);

    const el = field();
    el.focus();
    await userEvent.type(el, 'xy');
    pressKey(el, 'Backspace', 8);
    await settle();

    expect(changes).toEqual([]);
  });

  it('while typing, suggests up to 5 vocabulary matches excluding applied tags', async () => {
    const result = await renderInput({
      tags: ['area'],
      vocab: ['area', 'banana', 'canal', 'data', 'ocean', 'salsa', 'cabaret'],
    });

    await userEvent.type(field(), 'a');
    await settle();
    result.fixture.detectChanges();

    // Every vocab entry contains "a"; "area" is applied so it drops out, and the
    // list is capped at 5 in vocab order.
    const suggestions = result.fixture.componentInstance['suggestions']();
    expect(suggestions).toEqual(['banana', 'canal', 'data', 'ocean', 'salsa']);
    expect(suggestions).not.toContain('area');

    expect(screen.queryAllByRole('option').length).toBe(5);
  });

  it('shows no suggestions before the user types', async () => {
    const result = await renderInput({ tags: [], vocab: ['alpha', 'beta'] });
    expect(result.fixture.componentInstance['suggestions']()).toEqual([]);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('picking a suggestion adds it (lower-cased)', async () => {
    const result = await renderInput({ tags: [], vocab: ['Design', 'Docs', 'DevOps'] });
    const changes = captureChanges(result);

    await userEvent.type(field(), 'de');
    await settle();
    result.fixture.detectChanges();

    await userEvent.click(screen.getByRole('option', { name: 'DevOps' }));
    await settle();

    expect(changes).toEqual([['devops']]);
  });

  it('removing a chip emits the set without it', async () => {
    const result = await renderInput({ tags: ['keep', 'drop'] });
    const changes = captureChanges(result);

    await userEvent.click(screen.getByRole('button', { name: 'Remove drop' }));
    await settle();

    expect(changes).toEqual([['keep']]);
  });
});
