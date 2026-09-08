import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { WikiCodemirror } from './wiki-codemirror';

// Drives the CodeMirror keymap the same way the view's DOM keydown observer
// does, without the jsdom layout-measure path a synthetic DOM event would hit.
// Returns whether a binding handled the chord (CM then calls preventDefault()).
function dispatchChord(
  view: EditorView,
  key: string,
  opts: { shift?: boolean } = {},
): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    shiftKey: opts.shift ?? false,
    cancelable: true,
  });
  return runScopeHandlers(view, event, 'editor');
}

describe('WikiCodemirror', () => {
  it('renders an editable CodeMirror surface with the initial value', async () => {
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'Hello **world**' },
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const cmRoot = host.querySelector('.cm-editor');
    expect(cmRoot).not.toBeNull();
    expect(host.textContent).toContain('Hello');
  });

  it('emits valueChange when the user types', async () => {
    const events: string[] = [];
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'start' },
    });
    // In Angular 21, model() exposes .subscribe() directly on the signal (not as a separate valueChange property)
    fixture.componentInstance.value.subscribe((v: string) => events.push(v));
    // Dispatch a transaction directly on the EditorView to avoid jsdom layout-measure path
    // (userEvent keyboard triggers CM's requestAnimationFrame measure which calls getClientRects)
    const view = fixture.componentInstance.getView()!;
    const doc = view.state.doc;
    view.dispatch({
      changes: { from: doc.length, to: doc.length, insert: ' x' },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1]).toBe('start x');
  });

  it('replaces the doc when value() changes externally', async () => {
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'one' },
    });
    fixture.componentRef.setInput('value', 'two');
    fixture.detectChanges();
    await Promise.resolve();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('two');
    expect(host.textContent).not.toContain('one');
  });

  it('emits save when Ctrl+S is pressed', async () => {
    const user = userEvent.setup();
    let saved = 0;
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'hello' },
    });
    fixture.componentInstance.save.subscribe(() => { saved += 1; });
    const host = fixture.nativeElement as HTMLElement;
    const editable = host.querySelector('.cm-content') as HTMLElement;
    await user.click(editable);
    await user.keyboard('{Control>}s{/Control}');
    expect(saved).toBe(1);
  });

  it('destroys the EditorView on component destroy', async () => {
    const { fixture } = await render(WikiCodemirror, {
      inputs: { value: 'a' },
    });
    const view = fixture.componentInstance.getView();
    expect(view).not.toBeNull();
    fixture.destroy();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.cm-editor')).toBeNull();
  });

  it('toggling editable input dispatches reconfigure', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'a', editable: true } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView();
    expect(view).not.toBeNull();
    const editableBefore = view!.state.facet(EditorView.editable);
    expect(editableBefore).toBe(true);

    fixture.componentRef.setInput('editable', false);
    fixture.detectChanges();
    await Promise.resolve();

    const editableAfter = view!.state.facet(EditorView.editable);
    expect(editableAfter).toBe(false);
  });

  it('applyAction("bold") wraps the selection with **', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView();
    view!.dispatch({ selection: { anchor: 0, head: 5 } });
    fixture.componentInstance.applyAction('bold');
    expect(view!.state.doc.toString()).toBe('**hello** world');
  });

  it('Mod-b wraps the selection with **', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });
    dispatchChord(view, 'b');
    expect(view.state.doc.toString()).toBe('**hello** world');
  });

  it('Mod-i wraps the selection with *', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });
    dispatchChord(view, 'i');
    expect(view.state.doc.toString()).toBe('*hello* world');
  });

  it('Mod-` wraps the selection with backticks', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });
    dispatchChord(view, '`');
    expect(view.state.doc.toString()).toBe('`hello` world');
  });

  it('Mod-Shift-x wraps the selection with ~~', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });
    dispatchChord(view, 'x', { shift: true });
    expect(view.state.doc.toString()).toBe('~~hello~~ world');
  });

  it('Mod-k wraps the selection as a markdown link', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'hello world' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });
    dispatchChord(view, 'k');
    expect(view.state.doc.toString()).toBe('[hello](url) world');
  });

  it('Mod-b on an empty selection inserts the bold placeholder', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: '' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    dispatchChord(view, 'b');
    expect(view.state.doc.toString()).toBe('**bold text**');
  });

  it('Mod-k on an empty selection inserts the link placeholder and reports handled (CM then prevents default, so Search stays closed)', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: '' } });
    fixture.detectChanges();
    const view = fixture.componentInstance.getView()!;
    const handled = dispatchChord(view, 'k');
    expect(view.state.doc.toString()).toBe('[link text](url)');
    expect(handled).toBe(true);
  });

  it('insertText replaces a range with the given text', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'foo bar baz' } });
    fixture.detectChanges();
    fixture.componentInstance.insertText(4, 7, 'BAR');
    expect(fixture.componentInstance.getView()!.state.doc.toString()).toBe('foo BAR baz');
  });
});
