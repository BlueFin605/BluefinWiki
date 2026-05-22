import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { WikiCodemirror } from './wiki-codemirror';

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

  it('insertText replaces a range with the given text', async () => {
    const { fixture } = await render(WikiCodemirror, { inputs: { value: 'foo bar baz' } });
    fixture.detectChanges();
    fixture.componentInstance.insertText(4, 7, 'BAR');
    expect(fixture.componentInstance.getView()!.state.doc.toString()).toBe('foo BAR baz');
  });
});
