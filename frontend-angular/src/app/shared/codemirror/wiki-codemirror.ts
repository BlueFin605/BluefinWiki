import {
  type AfterViewInit,
  Component,
  ChangeDetectionStrategy,
  type ElementRef,
  type OnDestroy,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

@Component({
  selector: 'wiki-codemirror',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="wiki-codemirror"></div>`,
  styles: [`
    :host { display: block; height: 100%; }
    .wiki-codemirror { height: 100%; overflow: auto; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: #ffffff; }
    :host ::ng-deep .cm-editor { height: 100%; font-size: 14px; }
    :host ::ng-deep .cm-scroller { font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; line-height: 1.6; }
    :host ::ng-deep .cm-content { padding: 16px; }
    :host ::ng-deep .cm-line { padding: 0 8px; }
    :host ::ng-deep .cm-focused { outline: none; }
  `],
})
export class WikiCodemirror implements AfterViewInit, OnDestroy {
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly value = model<string>('');
  readonly editable = input<boolean>(true);
  readonly save = output<void>();

  private view: EditorView | null = null;
  private suppressEmit = false;

  constructor() {
    effect(() => {
      const incoming = this.value();
      const view = this.view;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === incoming) return;
      this.suppressEmit = true;
      view.dispatch({ changes: { from: 0, to: current.length, insert: incoming } });
      this.suppressEmit = false;
    });
  }

  ngAfterViewInit(): void {
    this.view = new EditorView({
      state: this.makeState(this.value()),
      parent: this.hostRef().nativeElement,
    });
  }

  ngOnDestroy(): void {
    this.view?.destroy();
    this.view = null;
  }

  getView(): EditorView | null {
    return this.view;
  }

  private makeState(doc: string): EditorState {
    const onSave = this.save;
    const valueModel = this.value;
    const isSuppressed = (): boolean => this.suppressEmit;
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onSave.emit();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        if (isSuppressed()) return;
        valueModel.set(u.state.doc.toString());
      }),
      EditorView.editable.of(this.editable()),
    ];
    return EditorState.create({ doc, extensions });
  }
}
